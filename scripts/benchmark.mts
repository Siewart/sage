import fs from "node:fs";
import os from "node:os";
import { makeDataSetFromPath } from "../packages/sage-core/gen/study/init.js";
import { createEnhancedBattleAnalysisSystem } from "../packages/sage-core/src/templates/study/enhanced-study-system.js";
const output = console.log;
console.log = () => {};
const start = performance.now();
const data = makeDataSetFromPath(process.argv[2]!, "duckdb");
try {
  const result = await createEnhancedBattleAnalysisSystem(data as any, {
    moduleConfig: "base",
    useGeminiAI: false,
  }).generateText();
  const bins = data.query.binTimes();
  const report = {
    match: data.name,
    sourceRevision: "4a5f43317d1afec1e49a0c6950cf10b09abc0f58",
    module: "base",
    realiser: "templates",
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    cpu: os.cpus()[0]?.model,
    elapsedMs: performance.now() - start,
    maxRssBytes: process.resourceUsage().maxRSS * 1024,
    snapshots: bins.length,
    gameDurationMs: bins.at(-1)![1] - bins[0]![0],
    sections: result.currentOutput.length,
    cache:
      "Downloaded/extracted Parquet; no network during measurement; native query cache starts cold",
  };
  fs.writeFileSync(process.argv[3]!, JSON.stringify(report, null, 2));
  output(report);
} finally {
  data.query.close();
}
