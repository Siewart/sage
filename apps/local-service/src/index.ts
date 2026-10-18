import http from "node:http";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createLocalRouter } from "@sage/contracts/router";
import { Settings } from "./settings.js";
import { Backend } from "./backend.js";
import { LocalAuth } from "./auth.js";

export async function createService(
  options: { home?: string; port?: number; origins?: string[] } = {},
) {
  const settings = new Settings(options.home);
  const backend = new Backend(settings);
  const origins = new Set(
    options.origins ??
      (
        process.env["SAGE_ALLOWED_ORIGINS"] ??
        "http://127.0.0.1:3000,http://localhost:3000"
      )
        .split(",")
        .map((value) => value.trim()),
  );
  const auth = new LocalAuth(settings.home, origins);
  const router = createLocalRouter(backend);
  const json = (
    response: http.ServerResponse,
    status: number,
    data: unknown,
  ) => {
    response.writeHead(status, {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    response.end(JSON.stringify(data));
  };
  const server = http.createServer((request, response) => {
    void (async () => {
      const address = server.address();
      const port =
        typeof address === "object" && address
          ? address.port
          : (options.port ?? 5417);
      if (
        ![`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`].includes(
          request.headers.host ?? "",
        )
      ) {
        json(response, 403, { error: "Invalid Host" });
        return;
      }
      const origin = request.headers.origin ?? "";
      if (!origins.has(origin)) {
        json(response, 403, {
          error:
            "Origin is not allowed; configure SAGE_ALLOWED_ORIGINS locally",
        });
        return;
      }
      response.setHeader("Access-Control-Allow-Origin", origin);
      response.setHeader("Vary", "Origin");
      response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      response.setHeader(
        "Access-Control-Allow-Headers",
        "Authorization, Content-Type",
      );
      response.setHeader("Access-Control-Allow-Private-Network", "true");
      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }
      const url = new URL(request.url ?? "/", `http://127.0.0.1:${port}`);
      if (url.pathname === "/health" && request.method === "GET") {
        json(response, 200, { service: "sage", version: 1 });
        return;
      }
      const readBody = async () => {
        const chunks: Buffer[] = [];
        let bytes = 0;
        for await (const chunk of request) {
          bytes += chunk.length;
          if (bytes > 1024 * 1024) throw new Error("Request too large");
          chunks.push(Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
      };
      if (url.pathname === "/pair" && request.method === "POST") {
        try {
          const body = JSON.parse((await readBody()).toString("utf8"));
          const token = auth.pair(String(body.code ?? ""), origin);
          json(response, 200, { token });
        } catch {
          json(response, 403, {
            error: "Pairing failed; check the code and allowed origin",
          });
        }
        return;
      }
      const token = (request.headers.authorization ?? "").replace(
        /^Bearer /,
        "",
      );
      if (!auth.allowed(token, origin)) {
        json(response, 401, { error: "Pair with the local service first" });
        return;
      }
      if (url.pathname === "/events" && request.method === "GET") {
        const id = url.searchParams.get("id") ?? "",
          after = Number(url.searchParams.get("after") ?? "0");
        backend.getRun(id);
        if (!Number.isSafeInteger(after) || after < 0) {
          json(response, 400, { error: "Invalid event cursor" });
          return;
        }
        response.writeHead(200, {
          "Content-Type": "application/x-ndjson",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        });
        const backlog = backend.events(id, after, 1000);
        for (const event of backlog)
          response.write(JSON.stringify(event) + "\n");
        if (backlog.length === 1000) {
          response.end();
          return;
        }
        const emit = (event: unknown) => {
          if (!response.write(JSON.stringify(event) + "\n")) response.end();
        };
        backend.emitter.on(id, emit);
        const heartbeat = setInterval(() => response.write("\n"), 15000);
        request.on("close", () => {
          clearInterval(heartbeat);
          backend.emitter.off(id, emit);
        });
        return;
      }
      if (url.pathname.startsWith("/trpc/")) {
        const body = request.method === "POST" ? await readBody() : undefined;
        const webRequest = new Request(url, {
          method: request.method ?? "GET",
          headers: new Headers(
            Object.entries(request.headers).filter(
              (entry): entry is [string, string] =>
                typeof entry[1] === "string",
            ),
          ),
          ...(body ? { body } : {}),
        });
        const result = await fetchRequestHandler({
          endpoint: "/trpc",
          req: webRequest,
          router,
          createContext: () => ({}),
        });
        response.writeHead(result.status, Object.fromEntries(result.headers));
        response.end(Buffer.from(await result.arrayBuffer()));
        return;
      }
      json(response, 404, { error: "Endpoint not found" });
    })().catch(() => {
      if (!response.headersSent)
        json(response, 400, { error: "Local request failed" });
      else response.end();
    });
  });
  server.listen(
    options.port ?? Number(process.env["SAGE_PORT"] ?? 5417),
    "127.0.0.1",
  );
  await once(server, "listening");
  return {
    server,
    backend,
    auth,
    close: async () => {
      await backend.shutdown();
      server.closeAllConnections();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const service = await createService();
  const address = service.server.address() as { port: number };
  console.log(`SAGE local service: http://127.0.0.1:${address.port}`);
  console.log(`Pairing code: ${service.auth.pairingCode()}`);
  const stop = () => {
    void service.close().then(() => process.exit(0));
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
