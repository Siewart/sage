import fs from "fs";

import {
  createEnhancedBattleAnalysisSystem,
  EnhancedStudySystemConfig,
} from "../../src/templates/study/enhanced-study-system.js";
import { makeDataSet } from "./init.js";

export const setup: EnhancedStudySystemConfig = {
  timeoutMs: 45000,
  moduleConfig: "all",
};

export async function doFromDataSet(
  dataSet: ReturnType<typeof makeDataSet>,
  surveyId: string,
  config: "expertInsights" | "all" | "base" | "eventStructuring",
) {
  const enhancedSystem = createEnhancedBattleAnalysisSystem(dataSet, {
    ...setup,
    moduleConfig: config,
  });
  const results = await enhancedSystem.generateText();
  const debugInfo = enhancedSystem.getDebugInfo();
  console.log(
    `\nDebug info: ${debugInfo.requests.length} Gemini requests, ${debugInfo.responses.length} responses`,
  );

  generateMarkdownReport(results, enhancedSystem.name + ` ${surveyId}`);
}

export function generateMarkdownReport(
  narratives: { currentOutput: string[]; usedData: unknown[] },
  name: string,
) {
  const {
    name: name1,
    civilization: civilization1,
    color: color1,
  } = (narratives.usedData as any[])[0].startPlayerInfo[0].playerInfo;
  const {
    name: name2,
    civilization: civilization2,
    color: color2,
  } = (narratives.usedData as any[])[0].startPlayerInfo[1].playerInfo;
  let markdown = `# ${name1} (${civilization1}, ${color1}) vs ${name2} (${civilization2}, ${color2})\n\n`;

  if (narratives.currentOutput.length > 0) {
    narratives.currentOutput.forEach((entry, i) => {
      // if (!entry.includes("<DEFER>")) {
      markdown += `\n${(narratives.usedData[i] as { timestamp: string }).timestamp} - ${entry}\n`;
      // } else {
      // console.log(`Skipping empty output for entry ${i}`);
      // }
    });
  }
  fs.writeFileSync(`./reports/${name}.md`, markdown);
  fs.writeFileSync(
    `./reports/${name}-data.json`,
    JSON.stringify(narratives.usedData, null, 2),
  );
  console.log(`\nReport generated: ./reports/${name}`);
}

// Key:
// Data Set 1 -> T1
// Data Set 2 -> T2
// Data Set 3 -> T3
// Data Set 4 -> T4

// All -> M1
// Base -> M2
// Event Structuring -> M3
// Expert Insights -> M4

