"use client";
import { useEffect, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Button } from "@sage/ui";

type Theme = "system" | "light" | "dark";
function savedTheme(): Theme {
  try {
    const value = localStorage.getItem("sage-theme");
    if (value === "light" || value === "dark") return value;
  } catch {
    // The system preference remains available without storage.
  }
  return "system";
}
function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  if (isTauri())
    void getCurrentWindow()
      .setTheme(theme === "system" ? null : theme)
      .catch((error) =>
        console.warn("Window theme could not be updated", error),
      );
  window.dispatchEvent(new Event("sage-theme-change"));
}
function saveTheme(theme: Theme) {
  let error = "";
  try {
    localStorage.setItem("sage-theme", theme);
  } catch {
    error = "Theme changed for this session. Your browser could not save it.";
  }
  applyTheme(theme);
  return error;
}
function useTheme() {
  const [theme, setTheme] = useState<Theme>("system");
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => {
      const value = document.documentElement.dataset.theme;
      setTheme(value === "dark" || value === "light" ? value : "system");
      setSystemDark(media.matches);
    };
    update();
    window.addEventListener("sage-theme-change", update);
    media.addEventListener("change", update);
    return () => {
      window.removeEventListener("sage-theme-change", update);
      media.removeEventListener("change", update);
    };
  }, []);
  return {
    theme,
    dark: theme === "dark" || (theme === "system" && systemDark),
  };
}
export function ThemeRuntime() {
  useEffect(() => {
    applyTheme(savedTheme());
    const update = (event: StorageEvent) => {
      if (event.key === "sage-theme" || event.key === null)
        applyTheme(savedTheme());
    };
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, []);
  return null;
}
export function ThemeSetting() {
  const { theme } = useTheme();
  const [error, setError] = useState("");
  return (
    <div className="panel-body stack">
      <label>
        Theme
        <select
          value={theme}
          onChange={(event) => {
            setError(saveTheme(event.target.value as Theme));
          }}
        >
          <option value="system">Use system setting</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </label>
      <p className="small muted">
        Saved on this device. System follows your computer’s appearance.
      </p>
      {error && (
        <p role="status" className="small muted">
          {error}
        </p>
      )}
    </div>
  );
}

export function ThemeToggle() {
  const { dark } = useTheme();
  const [error, setError] = useState("");
  const label = dark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <div className="theme-toggle-container">
      <Button
        className="secondary icon-button theme-toggle"
        aria-label={label}
        title={label}
        onClick={() => setError(saveTheme(dark ? "light" : "dark"))}
      >
        <svg
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {dark ? (
            <>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </>
          ) : (
            <path d="M20.9 13.2A9 9 0 0 1 10.8 3.1 9 9 0 1 0 20.9 13.2Z" />
          )}
        </svg>
      </Button>
      {error && (
        <span role="status" className="connection-popover small">
          {error}
        </span>
      )}
    </div>
  );
}
