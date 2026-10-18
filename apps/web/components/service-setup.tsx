"use client";

import { useEffect, useState } from "react";
import { Button } from "@sage/ui";

/** Startup guidance stays available after pairing, including on a hosted UI. */
export function ServiceSetup({ expanded = false }: { expanded?: boolean }) {
  const [origin, setOrigin] = useState("");
  const [shell, setShell] = useState("posix");
  const [copyStatus, setCopyStatus] = useState("");
  useEffect(() => setOrigin(window.location.origin), []);
  const serviceCommand =
    shell === "powershell"
      ? `$env:SAGE_ALLOWED_ORIGINS = '${origin}'; pnpm --filter @sage/local-service start`
      : `SAGE_ALLOWED_ORIGINS='${origin}' pnpm --filter @sage/local-service start`;
  const download = process.env["NEXT_PUBLIC_SAGE_DOWNLOAD_URL"];
  const downloadUrl = download?.startsWith("https://") ? download : undefined;
  return (
    <details className="panel settings" open={expanded || undefined}>
      <summary className="panel-body">
        <strong>Open the SAGE desktop app</strong>
      </summary>
      <div className="panel-body stack">
        <p>
          Download SAGE for your computer, install it, and open the SAGE app. It
          starts the local service and opens the interface automatically. No
          terminal, Node.js, pnpm or pairing code is needed.
        </p>
        <ol style={{ listStyle: "decimal", paddingLeft: 22 }}>
          <li>Download the installer for macOS, Windows or Linux.</li>
          <li>
            Open SAGE from Applications, the Start menu, or your downloaded
            AppImage.
          </li>
          <li>
            Choose a match in the app. Downloaded files and DuckDB processing
            stay on your computer.
          </li>
        </ol>
        {downloadUrl ? (
          <a
            className="button"
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
          >
            Download SAGE
          </a>
        ) : (
          <p className="small muted">
            Desktop installers have not been publicly released yet. A download
            button will appear here when a release is available.
          </p>
        )}
        <details>
          <summary>Developer setup or connect an existing service</summary>
          <p>
            The service downloads files, runs DuckDB and saves runs on your
            computer. Start it in a terminal, then connect this page using its
            pairing code. This website cannot launch a program on your computer.
          </p>
          <ol
            className="stack"
            style={{ listStyle: "decimal", paddingLeft: 22 }}
          >
            <li>
              Open a terminal in your SAGE checkout for this version. You need
              Node.js 24 and pnpm 9.15.9. On first use, install the
              dependencies:
              <pre className="json">
                <code>pnpm install --frozen-lockfile</code>
              </pre>
            </li>
            <li>
              To use this website, start only the local service. Keep the
              terminal open.
              <label>
                Terminal syntax
                <select
                  value={shell}
                  onChange={(event) => {
                    setShell(event.target.value);
                    setCopyStatus("");
                  }}
                >
                  <option value="posix">macOS / Linux shell</option>
                  <option value="powershell">Windows PowerShell</option>
                </select>
              </label>
              <pre className="json">
                <code>
                  {origin
                    ? serviceCommand
                    : "Loading command for this website…"}
                </code>
              </pre>
              <div className="row">
                <Button
                  type="button"
                  className="secondary"
                  disabled={!origin}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(serviceCommand);
                      setCopyStatus("Command copied");
                    } catch {
                      setCopyStatus(
                        "Select the command above and copy it manually.",
                      );
                    }
                  }}
                >
                  Copy start command
                </Button>
                <span role="status">{copyStatus}</span>
              </div>
              <p className="small muted">
                This allows the website at {origin || "this address"} to pair
                with your local service.
              </p>
            </li>
            <li>
              Copy the service URL and one-time pairing code printed in the
              terminal into the connection form. The default URL is{" "}
              <code>http://127.0.0.1:5417</code>. Allow local-network access if
              your browser asks.
            </li>
          </ol>
          <details>
            <summary>Run the website and service entirely locally</summary>
            <p>
              In the same checkout, run <code>pnpm dev</code>. This starts both
              processes. Open the website URL printed in your terminal and enter
              its pairing code.
            </p>
            <p>
              For a production build, run <code>pnpm build</code>, then{" "}
              <code>pnpm start</code>.
            </p>
          </details>
          <p className="small muted">
            Connection failed? Check the service URL and terminal output. A
            pairing code works once; restart the service for a fresh code, then
            reconnect. If you are already paired, use Disconnect to show the
            connection form again.
          </p>
        </details>
      </div>
    </details>
  );
}
