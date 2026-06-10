/*
 * The contents of this file are subject to the Mozilla Public License
 * Version 2.0 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * https://www.mozilla.org/en-US/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
 * License for the specific language governing rights and limitations
 * under the License.
 *
 * The Original Code is "Simplenlg".
 *
 * The Initial Developer of the Original Code is Ehud Reiter, Albert Gatt and Dave Westwater.
 * Portions created by Ehud Reiter, Albert Gatt and Dave Westwater are Copyright (C) 2010-11 The University of Aberdeen. All Rights Reserved.
 *
 * Contributor(s): Ehud Reiter, Albert Gatt, Dave Westwater, Roman Kutlak, Margaret Mitchell, and Saad Mahamood.
 *
 * TypeScript conversion: Siewart van Wingerden (University of Twente)
 */

import { NLGFactory } from "../../../src/factory/NLGFactory.js";
import { Realiser } from "../../../src/index.js";
import { Feature } from "../../../src/features/Feature.js";
import getTestData from "../../englishTestSet.js";
import { PPPhraseSpec } from "../../../src/phrasespec/PPPhraseSpec.js";

let factory: NLGFactory, realiser: Realiser, d: ReturnType<typeof getTestData>;
let inTheRoom: PPPhraseSpec,
  behindTheCurtain: PPPhraseSpec,
  onTheRock: PPPhraseSpec,
  underTheTable: PPPhraseSpec;

beforeEach(() => {
  d = getTestData();
  factory = d.context.factory;
  realiser = d.realiser;

  inTheRoom = factory.createPrepositionPhrase("in", "the room");
  behindTheCurtain = factory.createPrepositionPhrase("behind", "the curtain");
  onTheRock = factory.createPrepositionPhrase("on", "the rock");
  underTheTable = factory.createPrepositionPhrase("under", "the table");
});

describe("Prepositional Phrase", () => {
  test("Basic", () => {
    expect(realiser.realise(inTheRoom).realisation).toBe("in the room");
    expect(realiser.realise(behindTheCurtain).realisation).toBe(
      "behind the curtain",
    );
    expect(realiser.realise(onTheRock).realisation).toBe("on the rock");
  });

  test("Complementation", () => {
    // Clear any existing complements and add a coordinated NP complement.
    inTheRoom.clearComplements();
    const nounRoom = factory.createNounPhraseDetNoun("the", "room");
    const nounCar = factory.createNounPhraseDetNoun("a", "car");
    const coordinatedNP = factory.createCoordinatedPhrase(nounRoom, nounCar);
    inTheRoom.addComplement(coordinatedNP);
    expect(realiser.realise(inTheRoom).realisation).toBe(
      "in the room and a car",
    );
  });

  test("Coordination", () => {
    // Case 1: Coordinate two prepositional phrases with default conjunction ("and")
    const coord1 = factory.createCoordinatedPhrase(inTheRoom, behindTheCurtain);
    expect(realiser.realise(coord1).realisation).toBe(
      "in the room and behind the curtain",
    );

    const coordMult = factory.createCoordinatedPhrase();
    coordMult.addCoordinate(inTheRoom);
    coordMult.addCoordinate(behindTheCurtain);
    coordMult.addCoordinate(onTheRock);

    expect(realiser.realise(coordMult).realisation).toBe(
      "in the room, behind the curtain and on the rock",
    );

    // Change conjunction to "or"
    coord1.features[Feature.CONJUNCTION] = "or";
    expect(realiser.realise(coord1).realisation).toBe(
      "in the room or behind the curtain",
    );

    // Case 2: Coordinate onTheRock and underTheTable using "or"
    const coord2 = factory.createCoordinatedPhrase(onTheRock, underTheTable);
    coord2.features[Feature.CONJUNCTION] = "or";
    expect(realiser.realise(coord2).realisation).toBe(
      "on the rock or under the table",
    );

    // Coordinate the two coordinated phrases
    const coord3 = factory.createCoordinatedPhrase(coord1, coord2);
    expect(realiser.realise(coord3).realisation).toBe(
      "in the room or behind the curtain and on the rock or under the table",
    );
  });
});
