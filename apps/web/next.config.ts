import type { NextConfig } from "next";
const config: NextConfig = {
  transpilePackages: ["@sage/ui"],
  poweredByHeader: false,
  ...(process.env["SAGE_DESKTOP_BUILD"] === "1"
    ? { output: "export" as const }
    : {}),
};
export default config;
