import type { Config } from "jest";

const jestConfig: Config = {
  preset: "ts-jest/presets/js-with-ts-esm",
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { useESM: true, diagnostics: false }],
  },
  testMatch: ["**/test/**/*.test.ts"],
  testTimeout: 180000,
};

export default jestConfig;
