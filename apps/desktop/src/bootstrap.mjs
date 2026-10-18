import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createInterface } from "node:readline";
const runtime = path.dirname(fileURLToPath(import.meta.url));
process.env.SAGE_RESOURCE_ROOT = path.join(runtime, "assets");
process.env.SAGE_WORKER_PATH = path.join(runtime, "worker.mjs");
process.env.SAGE_DUCKDB_WORKER = path.join(runtime, "duckdb-worker.mjs");
process.env.SAGE_LEXICON_URL = pathToFileURL(
  path.join(runtime, "assets/default-lexicon.xml"),
).href;
const origins = [
  "tauri://localhost",
  "http://tauri.localhost",
  "https://tauri.localhost",
];
console.log = () => {};
const reply = (value) => process.stdout.write(JSON.stringify(value) + "\n");
let service,
  closing = false;
const stop = async () => {
  if (closing) return;
  closing = true;
  await service?.close();
  process.exit(0);
};
try {
  const { createService } = await import("./service.mjs");
  service = await createService({
    home: process.env.SAGE_HOME,
    port: 0,
    origins,
  });
  const url = `http://127.0.0.1:${service.server.address().port}`;
  const sessions = new Map();
  const input = createInterface({ input: process.stdin });
  input.on("line", (line) => {
    try {
      const command = JSON.parse(line);
      if (command.command === "shutdown") {
        void stop();
        return;
      }
      if (command.command !== "session" || !origins.includes(command.origin))
        throw new Error("Invalid desktop request");
      let session = sessions.get(command.origin);
      if (!session || session.expiresAt < Date.now()) {
        session = {
          token: service.auth.pair(service.auth.pairingCode(), command.origin),
          expiresAt: Date.now() + 11 * 3600000,
        };
        sessions.set(command.origin, session);
      }
      reply({ url, token: session.token });
    } catch {
      reply({
        error:
          "The local service could not establish a session. Retry in a minute.",
      });
    }
  });
  input.on("close", () => void stop());
  process.on("SIGTERM", () => void stop());
  process.on("SIGINT", () => void stop());
  reply({ ready: true });
} catch (error) {
  process.stderr.write(String(error?.stack ?? error) + "\n");
  reply({ error: "The local service could not start" });
  process.exit(1);
}
