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
import { Tense } from "../../../src/features/Tense.js";
import getTestData from "../../englishTestSet.js";

describe("Premodifier Test", () => {
  let f: NLGFactory, realiser: Realiser, d: ReturnType<typeof getTestData>;

  beforeEach(() => {
    d = getTestData();
    f = d.context.factory;
    realiser = d.realiser;
  });

  test("Indefinite With Premodifier", () => {
    // Create a clause "there be" with present tense
    const clause = f.createClause("there", "be");
    clause.features[Feature.TENSE] = Tense.PRESENT;
    // Create NP with determiner "a" and noun "stenosis"
    const np = f.createNounPhraseDetNoun("a", "stenosis");
    clause.setObject(np);
    // Without modifier, article remains "a"
    expect(realiser.realise(clause).realisation).toBe("there is a stenosis");

    // Add an adjective phrase modifier "eccentric" to NP; article should change to "an"
    np.addPreModifier(f.createAdjectivePhrase("eccentric"));
    expect(realiser.realise(clause).realisation).toBe(
      "there is an eccentric stenosis",
    );
  });

  test("Multiple Adjective Premodifiers", () => {
    // Create NP with determiner "a" and noun "stenosis"
    const np = f.createNounPhraseDetNoun("a", "stenosis");
    // Add two adjective premodifiers: "eccentric" and "discrete"
    np.addPreModifier(f.createAdjectivePhrase("eccentric"));
    np.addPreModifier(f.createAdjectivePhrase("discrete"));
    expect(realiser.realise(np).realisation).toBe(
      "an eccentric, discrete stenosis",
    );
  });

  test("Multiple Adverb Premodifiers", () => {
    // Create two adverb phrases: "slowly" and "discretely"
    const adv1 = f.createAdverbPhrase("slowly");
    const adv2 = f.createAdverbPhrase("discretely");

    // Case 1: Concatenated premodifiers should be separated by a comma.
    const vp1 = f.createVerbPhrase("run");
    vp1.addPreModifier(adv1);
    vp1.addPreModifier(adv2);
    expect(realiser.realise(vp1).realisation).toBe("slowly, discretely runs");

    // Case 2: Coordinated premodifiers should be joined with 'and'
    const vp2 = f.createVerbPhrase("eat");
    vp2.addPreModifier(f.createCoordinatedPhrase(adv1, adv2));
    expect(realiser.realise(vp2).realisation).toBe(
      "slowly and discretely eats",
    );
  });
});
