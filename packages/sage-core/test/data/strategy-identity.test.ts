import path from "node:path";
import { fileURLToPath } from "node:url";
import { DATASET_CONFIGS, makeDataSet } from "../../gen/study/init.js";
import { GameStateExtractor } from "../../src/gamestate-extractor.js";
import { detectStrategies } from "../../src/fuzzy/strategy-detector.js";
import { strategyDetectors } from "../../src/fuzzy/strategies.js";

process.chdir(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../.."),
);
for (const config of DATASET_CONFIGS) {
  test(`${config.key}: numeric rule identities preserve strategy decisions across upgrades`, () => {
    const data = makeDataSet(config);
    try {
      const named = new GameStateExtractor(data),
        numeric = new GameStateExtractor(data, "ids");
      const times = data.descriptor.metadata.binTimes;
      const indices = [
        ...new Set(
          [0, 5, 10, 15, 20, times.length - 1].filter(
            (index) => index < times.length,
          ),
        ),
      ];
      for (const index of indices)
        for (const playerId of [1, 2]) {
          const timeMs = times[index]![0];
          const expected = detectStrategies(
            { ...named.extractGameState(timeMs, playerId), playerId },
            strategyDetectors,
            0.3,
          );
          const state = numeric.extractGameState(timeMs, playerId);
          expect(
            Object.keys(state.unitCounts).every(
              (key) => key.startsWith("string:") || key.startsWith("unknown:"),
            ),
          ).toBe(true);
          expect(
            detectStrategies({ ...state, playerId }, strategyDetectors, 0.3),
          ).toEqual(expected);
        }
    } finally {
      data.query.close();
    }
  });
}
