import { jest } from "@jest/globals";
import { execution } from "@sage/contracts/execution";
import {
  prepareHydration,
  hydrateForRealization,
} from "../../src/events/hydration.js";
import {
  classifyBattleFacts,
  battlesTemplate,
} from "../../src/templates/study/templates/battles-template.js";
import { buildingTemplate } from "../../src/templates/study/templates/building-template.js";
import { deferTemplate } from "../../src/templates/study/templates/defer.js";
import { deferredTemplate } from "../../src/templates/study/templates/deferredTemplate.js";
import { BaseContext } from "../../src/templates/study/study-context.js";
import { DATASET_CONFIGS, makeDataSet } from "../../gen/study/init.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
let data: ReturnType<typeof makeDataSet>;
beforeAll(() => {
  process.chdir(root);
  data = makeDataSet(DATASET_CONFIGS[0]!);
});
afterAll(() => data?.query.close());
const json = (value: unknown) => JSON.parse(JSON.stringify(value));

test("hydration is skipped for unselected facts and resolves nested grouped facts once", () => {
  let calls = 0;
  const facts = prepareHydration({ entityId: 83 }, () => {
    calls++;
    return { entityId: 83, name: "Villager" };
  });
  expect(json(facts)).toEqual({ entityId: 83 });
  expect(calls).toBe(0);
  const group = { events: [facts, facts] };
  expect(hydrateForRealization(group)).toEqual({
    events: [
      { entityId: 83, name: "Villager" },
      { entityId: 83, name: "Villager" },
    ],
  });
  expect(calls).toBe(1);
});

test.each([
  [true, 1, 0, "raid"],
  [false, 16, 9, "major battle"],
  [false, 9, 4, "skirmish"],
  [false, 10, 5, "battle"],
])(
  "battle decision uses identity/count facts (%s, %s, %s)",
  (hasVillagers, participantCount, casualtyCount, classification) => {
    expect(
      classifyBattleFacts({
        hasVillagers: hasVillagers as boolean,
        participantCount: participantCount as number,
        casualtyCount: casualtyCount as number,
      }).classification,
    ).toBe(classification);
  },
);

test("building classification is identical before and after name/location hydration", async () => {
  const first = data.descriptor.metadata.binTimes[0]![0];
  const entity = data.query.entities({
    bin: 0,
    ownerId: 1,
    masterIds: [109],
  })[0]!;
  const event = {
    type: "buildingConstructed" as const,
    entityId: Number(entity.id),
    subjectPlayerId: 1,
    worldTime: first,
    worldX: Number(entity.worldX),
    worldY: Number(entity.worldY),
    worldZ: 0,
  };
  const run = async (debugEarlyHydration: boolean) =>
    execution.run({ debugEarlyHydration }, async () => {
      const template = buildingTemplate(new BaseContext(data));
      const interpreted = template.eventInterpreter(event)!;
      const classification = template.eventClassifier(interpreted);
      return {
        raw: json(interpreted),
        classification,
        result: await template.eventRealiser(interpreted, classification, []),
      };
    });
  const late = await run(false),
    early = await run(true);
  expect(late.raw.refMasterId).toBe(109);
  expect(late.raw).not.toHaveProperty("playerName");
  expect(late.raw).not.toHaveProperty("location");
  expect(early.raw).toHaveProperty("playerName");
  expect(early.raw).toHaveProperty("location");
  expect(late.classification).toEqual(early.classification);
  expect(json(late.result)).toEqual(json(early.result));
});

test("deferred planning retains raw battle IDs and hydrates only the grouped realization", async () => {
  const events = data.query
    .events({
      modelTypes: ["damage", "death"],
      requireObjectPlayer: true,
      requireSubjectPlayer: true,
    })
    .slice(0, 30)
    .map((row) => ({ ...row, type: row["sage:modelType"] })) as any[];
  const startTime = events[0]!.worldTime,
    endTime = events.at(-1)!.worldTime;
  const input = {
    type: "battles" as const,
    worldTime: endTime,
    startTime,
    endTime,
    clusters: [
      {
        type: "battle" as const,
        worldTime: startTime,
        startTimeMs: startTime,
        endTimeMs: endTime,
        worldX: events[0]!.worldX,
        worldY: events[0]!.worldY,
        data: events,
      },
    ],
  };
  const run = async (debugEarlyHydration: boolean) =>
    execution.run({ debugEarlyHydration }, async () => {
      const context = new BaseContext(data);
      const template = deferTemplate(
        "battles",
        battlesTemplate(context),
        context,
      );
      const strings = jest.spyOn(data.query, "strings");
      template.eventInterpreter(input);
      const lookupsDuringInterpretation = strings.mock.calls.length;
      strings.mockRestore();
      const queued = context.peekDeferredRealisations();
      const group = deferredTemplate(context);
      const interpreted = group.eventInterpreter({
        type: "tick",
        worldTime: endTime + 180001,
      })!;
      const classification = group.eventClassifier(interpreted);
      return {
        raw: json(queued),
        lookupsDuringInterpretation,
        classification,
        result: await group.eventRealiser(interpreted, classification, []),
      };
    });
  const late = await run(false),
    early = await run(true);
  expect(late.lookupsDuringInterpretation).toBe(0);
  expect(early.lookupsDuringInterpretation).toBeGreaterThan(0);
  const rawBattle = late.raw[0].input.finishedBattles[0];
  expect(rawBattle).not.toHaveProperty("data");
  expect(
    Object.keys(rawBattle.player1.participants).every((id) =>
      /^-?\d+$/.test(id),
    ),
  ).toBe(true);
  expect(
    Object.values(rawBattle.player1.participants).reduce(
      (a: any, b: any) => a + b,
      0,
    ),
  ).toBeGreaterThan(0);
  expect(late.raw[0].input.finishedBattles[0]).not.toHaveProperty("location");
  expect(early.raw[0].input.finishedBattles[0]).toHaveProperty("location");
  expect(late.classification).toEqual(early.classification);
  expect(json(late.result)).toEqual(json(early.result));
});
