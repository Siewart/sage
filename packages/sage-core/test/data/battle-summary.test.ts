import { jest } from "@jest/globals";
import {
  summarizeBattle,
  summarizeOngoingBattle,
} from "../../src/templates/study/templates/battle-summary.js";

test("counts distinct entities by master ID before naming; repeated attacks and deaths do not inflate counts", () => {
  const units: any = {
    1: { masterId: 7, refMasterId: 7 },
    2: { masterId: 7, refMasterId: 7 },
    3: { masterId: 7, refMasterId: 7 },
    4: { masterId: 8, refMasterId: 8 },
  };
  const strings = jest.fn(() => []);
  const query = { masters: jest.fn(() => [{ stringId: 123 }]), strings };
  const queryEntity = jest.fn((id: any, _time: any, options: any) => ({
    ...units[id],
    ...(options?.resolveName === false
      ? {}
      : { name: id < 3 ? "Skirmisher" : "<<Unknown>>" }),
  }));
  const context: any = {
    queryEntity,
    getDataSet: () => ({ query, timeToWindow: () => 0 }),
  };
  const event = (
    objectEntity: number,
    subjectEntity: number,
    type = "damage",
  ) => ({
    type,
    objectEntity,
    subjectEntity,
    objectPlayerId: 1,
    subjectPlayerId: 2,
    worldTime: 100,
  });
  const raw: any = {
    type: "battle",
    worldTime: 100,
    startTimeMs: 100,
    endTimeMs: 200,
    worldX: 1,
    worldY: 2,
    data: [
      event(1, 3),
      event(1, 3),
      event(2, 4),
      event(1, 3, "death"),
      event(1, 3, "death"),
    ],
  };
  const summary = summarizeBattle(raw, context);
  expect(summary.facts.player1).toEqual({
    participants: { 7: 2 },
    casualties: { 7: 1 },
    survivors: { 7: 1 },
  });
  expect(summary.facts.player2.participants).toEqual({ 7: 1, 8: 1 });
  expect(summary.facts.participantCount).toBe(4);
  expect(summary.facts.casualtyCount).toBe(1);
  expect(summary.facts).not.toHaveProperty("data");
  expect(
    queryEntity.mock.calls.every((call) => call[2].resolveName === false),
  ).toBe(true);
  expect(strings).not.toHaveBeenCalled();
  expect(summary.hydrate().player1.participants).toEqual({ Skirmisher: 2 });
  // Hydration translates the already-counted maps, never re-reads the attack stream.
  raw.data.length = 0;
  expect(summary.hydrate().player1.casualties).toEqual({ Skirmisher: 1 });
});

test("ongoing reports count snapshot unit IDs without resolving strings", () => {
  const strings = jest.fn(() => [{ string: "Knight" }]);
  const query = {
    entities: jest.fn(() => [
      { id: 1, refMasterId: 38, ownerId: 1 },
      { id: 2, refMasterId: 38, ownerId: 1 },
    ]),
    masters: jest.fn(() => [{ stringId: 5068 }]),
    strings,
  };
  const context: any = { getDataSet: () => ({ query, timeToWindow: () => 0 }) };
  const result = summarizeOngoingBattle(
    { worldX: 1, worldY: 2, startTimeMs: 0, data: [] } as any,
    context,
    100,
  );
  expect(result.facts.player1.participants).toEqual({ 38: 2 });
  expect(strings).not.toHaveBeenCalled();
  expect(result.hydrate().player1.participants).toEqual({ Knight: 2 });
});
