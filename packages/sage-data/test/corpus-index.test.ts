import test from "node:test";
import assert from "node:assert/strict";
import { parseCorpusIndex } from "../src/hf/index.js";
test("uses recorded metadata and preserves null Elo rather than guessing from filenames", () => {
  const result = parseCorpusIndex({
    generatedAt: "2026-07-12T00:00:00Z",
    games: [
      {
        gameName: "A_(Franks)_2200_vs_B",
        mapName: "arabia",
        durationMs: 1000,
        isRanked: true,
        split: "train",
        players: [
          {
            playerId: 1,
            name: "A",
            civId: 2,
            civName: "Franks",
            elo: null,
            won: false,
          },
        ],
      },
    ],
  });
  const record = result.get("A_(Franks)_2200_vs_B")!;
  assert.equal(record.players[0]!.elo, null);
  assert.equal(record.mapName, "arabia");
  assert.equal(record.indexGeneratedAt, "2026-07-12T00:00:00Z");
  assert.equal(result.get("absent"), undefined);
});
test("malformed records cannot prevent valid index rows being used", () => {
  const result = parseCorpusIndex({
    games: [
      null,
      { gameName: "valid", players: [] },
      { gameName: "bad", players: [{}] },
    ],
  });
  assert.deepEqual([...result.keys()], ["valid"]);
});
