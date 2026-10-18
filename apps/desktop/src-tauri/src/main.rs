#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use serde::{Deserialize, Serialize};
use std::{
    fs::{self, OpenOptions},
    io::{BufRead, BufReader, Write},
    path::PathBuf,
    process::{Child, ChildStdin, Command, Stdio},
    sync::{mpsc, Arc, Mutex},
    thread,
    time::{Duration, Instant},
};
use tauri::{Emitter, Manager};

#[derive(Serialize, Deserialize)]
struct Session {
    url: String,
    token: String,
}
struct Runtime {
    child: Child,
    input: ChildStdin,
    replies: mpsc::Receiver<String>,
    stopped: bool,
}
impl Runtime {
    fn start(app: &tauri::AppHandle) -> Result<Self, String> {
        let home = std::env::var_os("SAGE_HOME")
            .map(PathBuf::from)
            .unwrap_or(app.path().app_data_dir().map_err(|e| e.to_string())?);
        fs::create_dir_all(&home).map_err(|e| e.to_string())?;
        let mut options = OpenOptions::new();
        options.create(true).append(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let log = options
            .open(home.join("launcher.log"))
            .map_err(|e| e.to_string())?;
        let resources = app
            .path()
            .resource_dir()
            .map_err(|e| e.to_string())?
            .join("runtime");
        let executable = std::env::current_exe().map_err(|e| e.to_string())?;
        let node = executable
            .parent()
            .ok_or("Application directory is missing")?
            .join(if cfg!(windows) {
                "sage-runtime.exe"
            } else {
                "sage-runtime"
            });
        let mut command = Command::new(node);
        command
            .arg(resources.join("bootstrap.mjs"))
            .env("SAGE_HOME", &home)
            .env(
                "SAGE_DATA_DIR",
                std::env::var_os("SAGE_DATA_DIR")
                    .map(PathBuf::from)
                    .unwrap_or(home.join("data")),
            )
            .env_remove("NODE_OPTIONS")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::from(log));
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000);
        }
        let mut child = command.spawn().map_err(|e| e.to_string())?;
        let input = child.stdin.take().ok_or("Runtime input unavailable")?;
        let output = child.stdout.take().ok_or("Runtime output unavailable")?;
        let (sender, replies) = mpsc::channel();
        thread::spawn(move || {
            for line in BufReader::new(output).lines() {
                match line {
                    Ok(line) => {
                        if sender.send(line).is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        });
        let mut runtime = Self {
            child,
            input,
            replies,
            stopped: false,
        };
        let ready = runtime.receive()?;
        if ready.get("ready").and_then(|v| v.as_bool()) != Some(true) {
            runtime.shutdown();
            return Err("The local runtime did not become ready".into());
        }
        Ok(runtime)
    }
    fn receive(&mut self) -> Result<serde_json::Value, String> {
        let line = self
            .replies
            .recv_timeout(Duration::from_secs(30))
            .map_err(|_| "The local runtime stopped or timed out".to_string())?;
        serde_json::from_str(&line).map_err(|_| "Invalid local runtime response".into())
    }
    fn session(&mut self, origin: &str) -> Result<Session, String> {
        writeln!(
            self.input,
            "{}",
            serde_json::json!({"command":"session","origin":origin})
        )
        .map_err(|e| e.to_string())?;
        self.input.flush().map_err(|e| e.to_string())?;
        let response = self.receive()?;
        serde_json::from_value(response)
            .map_err(|_| "The local service could not establish a session".into())
    }
    fn shutdown(&mut self) {
        if self.stopped {
            return;
        }
        self.stopped = true;
        let _ = writeln!(self.input, "{{\"command\":\"shutdown\"}}");
        let _ = self.input.flush();
        let deadline = Instant::now() + Duration::from_secs(7);
        while Instant::now() < deadline {
            match self.child.try_wait() {
                Ok(Some(_)) => return,
                Err(_) => break,
                _ => thread::sleep(Duration::from_millis(50)),
            }
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}
impl Drop for Runtime {
    fn drop(&mut self) {
        self.shutdown();
    }
}
#[derive(Clone, Default)]
struct DesktopState(Arc<Mutex<Option<Runtime>>>);
fn desktop_origin(url: &str) -> Option<&'static str> {
    [
        "tauri://localhost",
        "http://tauri.localhost",
        "https://tauri.localhost",
    ]
    .into_iter()
    .find(|origin| url == *origin || url.starts_with(&format!("{origin}/")))
}
#[tauri::command]
async fn desktop_session(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    state: tauri::State<'_, DesktopState>,
) -> Result<Session, String> {
    if window.label() != "main" {
        return Err("Invalid window".into());
    }
    let url = window.url().map_err(|e| e.to_string())?.to_string();
    let origin = desktop_origin(&url).ok_or("Invalid desktop origin")?;
    let shared = state.0.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let mut guard = shared
            .lock()
            .map_err(|_| "Local runtime is unavailable".to_string())?;
        let exited = guard
            .as_mut()
            .map(|runtime| {
                runtime
                    .child
                    .try_wait()
                    .map(|status| status.is_some())
                    .unwrap_or(true)
            })
            .unwrap_or(false);
        if exited {
            guard.take();
        }
        if guard.is_none() {
            *guard = Some(Runtime::start(&app)?);
        }
        let result = guard.as_mut().unwrap().session(origin);
        if result.is_err() {
            guard.take();
        }
        result
    })
    .await
    .map_err(|e| e.to_string())?
}
#[tauri::command]
fn desktop_diagnostics(app: tauri::AppHandle) -> Result<(), String> {
    let directory = std::env::var_os("SAGE_HOME")
        .map(PathBuf::from)
        .unwrap_or(app.path().app_data_dir().map_err(|e| e.to_string())?);
    fs::create_dir_all(&directory).map_err(|e| e.to_string())?;
    let mut command = Command::new(if cfg!(target_os = "macos") {
        "open"
    } else if cfg!(windows) {
        "explorer.exe"
    } else {
        "xdg-open"
    });
    command.arg(directory).spawn().map_err(|e| e.to_string())?;
    Ok(())
}
fn main() {
    let state = DesktopState::default();
    let shutdown = state.clone();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .manage(state)
        .setup(|app| {
            let handle = app.handle().clone();
            let shared = app.state::<DesktopState>().0.clone();
            thread::spawn(move || loop {
                thread::sleep(Duration::from_secs(2));
                let stopped = if let Ok(mut guard) = shared.lock() {
                    let exited = guard
                        .as_mut()
                        .map(|runtime| {
                            runtime
                                .child
                                .try_wait()
                                .map(|status| status.is_some())
                                .unwrap_or(true)
                        })
                        .unwrap_or(false);
                    if exited {
                        guard.take();
                    }
                    exited
                } else {
                    false
                };
                if stopped {
                    let _ = handle.emit("desktop-runtime-stopped", ());
                }
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            desktop_session,
            desktop_diagnostics
        ])
        .build(tauri::generate_context!())
        .expect("SAGE application configuration is invalid")
        .run(move |_app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                if let Ok(mut guard) = shutdown.0.lock() {
                    guard.take();
                }
            }
        });
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn only_packaged_origins_can_receive_a_session() {
        assert_eq!(
            desktop_origin("tauri://localhost/index.html"),
            Some("tauri://localhost")
        );
        assert_eq!(
            desktop_origin("http://tauri.localhost/"),
            Some("http://tauri.localhost")
        );
        for url in [
            "https://evil.example/",
            "http://tauri.localhost.evil/",
            "file:///tmp/index.html",
        ] {
            assert!(desktop_origin(url).is_none());
        }
    }
}
