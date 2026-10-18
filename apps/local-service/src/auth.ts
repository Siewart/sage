import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export class LocalAuth {
  private code = randomBytes(8).toString("hex");
  private sessions: { hash: string; origin: string; expires: number }[] = [];
  private attempts: number[] = [];
  private file: string;
  constructor(
    home: string,
    readonly origins: Set<string>,
  ) {
    this.file = path.join(home, "sessions.json");
    try {
      this.sessions = JSON.parse(fs.readFileSync(this.file, "utf8")).filter(
        (x: { expires: number }) => x.expires > Date.now(),
      );
    } catch {
      /* first start */
    }
  }
  pairingCode() {
    return this.code;
  }
  pair(code: string, origin: string): string {
    this.attempts = this.attempts.filter((t) => t > Date.now() - 60000);
    if (this.attempts.length >= 5)
      throw new Error("Pairing rate limit; retry in one minute");
    this.attempts.push(Date.now());
    const received = Buffer.from(code),
      expected = Buffer.from(this.code);
    if (
      !this.origins.has(origin) ||
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    )
      throw new Error("Invalid pairing code or origin");
    const token = randomBytes(32).toString("base64url");
    this.sessions.push({
      hash: createHash("sha256").update(token).digest("hex"),
      origin,
      expires: Date.now() + 12 * 3600000,
    });
    fs.writeFileSync(this.file, JSON.stringify(this.sessions), { mode: 0o600 });
    this.code = randomBytes(8).toString("hex");
    return token;
  }
  allowed(token: string, origin: string): boolean {
    const hash = createHash("sha256").update(token).digest("hex");
    return (
      this.origins.has(origin) &&
      this.sessions.some(
        (value) =>
          value.expires > Date.now() &&
          value.origin === origin &&
          value.hash === hash,
      )
    );
  }
}
