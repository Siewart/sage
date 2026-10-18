if (process.platform === "win32") await import("./package-windows.mjs");
else await import("./package-local.mjs");
