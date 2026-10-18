import {
  canonicalUnitId,
  referenceUnit,
  withReferenceNames,
} from "../../src/aoe2/unit-reference.js";

test("pinned Halfon identifies the reported missing units and expansion units", () => {
  expect(referenceUnit(280)?.name).toBe("Mangonel");
  expect(referenceUnit(279)?.name).toBe("Scorpion");
  expect(referenceUnit(1803)?.name).toBe("Monaspa");
  expect(referenceUnit(1811)?.name).toBe("Warrior Priest");
});
test("numeric upgrade identity distinguishes transformed exported master IDs", () => {
  expect(canonicalUnitId(7, 7, 5088)).toBe(7);
  expect(canonicalUnitId(7, 7, 5087)).toBe(6);
  expect(canonicalUnitId(4, 4, 5084)).toBe(24);
});
test("match-local dictionaries win and fallback fills only missing labels", () => {
  const q: any = {
    strings: () => [{ id: 5088, string: "Original match name" }],
    namedEntities: () => [
      { refMasterId: 280, name: undefined },
      { refMasterId: 279, name: "Match Scorpion" },
    ],
    namedResearchStates: () => [],
  };
  const wrapped = withReferenceNames(q);
  expect(wrapped.strings({ ids: [5088] })[0]?.["string"]).toBe(
    "Original match name",
  );
  expect(wrapped.namedEntities({ bin: 0 })).toEqual([
    { refMasterId: 280, name: "Mangonel" },
    { refMasterId: 279, name: "Match Scorpion" },
  ]);
});
