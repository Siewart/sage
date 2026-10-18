import fs from "node:fs";
import { z } from "zod";
import { fetchFile, type HuggingFaceOptions } from "./client.js";
import type { SageLayout } from "./layout.js";
const player = z.object({
  playerId: z.number(),
  name: z.string(),
  civId: z.number().nullable().optional(),
  civName: z.string().nullable().optional(),
  elo: z.number().nullable().optional(),
  won: z.boolean().nullable().optional(),
});
const game = z.object({
  gameName: z.string(),
  gameId: z.string().nullable().optional(),
  mapName: z.string().nullable().optional(),
  mapSize: z.union([z.string(), z.number()]).nullable().optional(),
  mapWidth: z.number().nullable().optional(),
  mapHeight: z.number().nullable().optional(),
  durationMs: z.number().nonnegative().nullable().optional(),
  isRanked: z.boolean().nullable().optional(),
  split: z.string().nullable().optional(),
  players: z.array(player),
});
export function parseCorpusIndex(value: unknown) {
  const root = z
    .object({ generatedAt: z.string().optional(), games: z.array(z.unknown()) })
    .parse(value);
  const result = new Map<
    string,
    {
      mapName?: string | null;
      mapSize?: string | number | null;
      mapWidth?: number | null;
      mapHeight?: number | null;
      durationMs?: number | null;
      isRanked?: boolean | null;
      split?: string | null;
      players: z.infer<typeof player>[];
      indexGeneratedAt?: string;
    }
  >();
  for (const item of root.games) {
    const parsed = game.safeParse(item);
    if (!parsed.success) continue;
    const { gameName, gameId: _gameId, ...metadata } = parsed.data;
    result.set(gameName, {
      ...metadata,
      ...(root.generatedAt ? { indexGeneratedAt: root.generatedAt } : {}),
    });
  }
  return result;
}
export async function loadCorpusIndex(
  layout: SageLayout,
  corpus: string,
  options: HuggingFaceOptions = {},
) {
  if (!/^[a-z0-9-]+$/i.test(corpus)) throw new Error("Invalid corpus");
  const file = await fetchFile(layout, `${corpus}/index.json`, options);
  return parseCorpusIndex(JSON.parse(fs.readFileSync(file, "utf8")));
}
