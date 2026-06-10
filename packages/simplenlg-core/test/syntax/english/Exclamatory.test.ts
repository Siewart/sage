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
import { Tense } from "../../../src/features/Tense.js";
import { InterrogativeType } from "../../../src/features/InterrogativeType.js";
import { Feature } from "../../../src/features/Feature.js";
import getTestData from "../../englishTestSet.js";

describe("Exclamatory Test", () => {
  let f: NLGFactory, realiser: Realiser, d: ReturnType<typeof getTestData>;

  beforeEach(() => {
    d = getTestData();
    f = d.context.factory;
    realiser = d.realiser;
  });

  test("Simple Clause Exclamatory Test", () => {
    // create a clause with subject "Mary", verb "chase", object "George"
    const clause = f.createClause("Mary", "chase", "George");
    // set exclamatory flag and add a PP postmodifier "in the park"
    clause.features[Feature.EXCLAMATORY] = true;
    clause.addPostModifier(f.createPrepositionPhrase("in", "the park"));
    const sentence = f.createSentence(clause);
    // expected exclamation at end
    expect(realiser.realise(sentence).realisation).toBe(
      "Mary chases George in the park!",
    );
  });

  test("Coordinated Phrase Exclamatory Test", () => {
    // first clause: "Mary chase George in the park" with past tense
    const clause1 = f.createClause("Mary", "chase", "George");
    clause1.features[Feature.TENSE] = Tense.PAST;
    clause1.addPostModifier(f.createPrepositionPhrase("in", "the park"));
    // second clause: "she run him into the pond" with past tense
    const clause2 = f.createClause("she", "run", "him");
    clause2.features[Feature.TENSE] = Tense.PAST;
    clause2.addPostModifier(f.createPrepositionPhrase("into", "the pond"));
    // coordinate the two clauses with a conjunction
    const coord = f.createCoordinatedPhrase(clause1, clause2);
    coord.conjunction = "and then";
    // create sentence and set exclamatory flag
    const sentence = f.createSentence(coord);
    sentence.features[Feature.EXCLAMATORY] = true;
    expect(realiser.realise(sentence).realisation).toBe(
      "Mary chased George in the park and then she ran him into the pond!",
    );
  });

  test("Interrogative Exclamatory Test", () => {
    // create a clause and set interrogative type and exclamatory flag (interrogative overrides)
    const clause = f.createClause("Mary", "chase", "George");
    clause.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHAT_OBJECT;
    clause.features[Feature.EXCLAMATORY] = true;
    const sentence = f.createSentence(clause);
    expect(realiser.realise(sentence).realisation).toBe(
      "What does Mary chase?",
    );
  });
});
