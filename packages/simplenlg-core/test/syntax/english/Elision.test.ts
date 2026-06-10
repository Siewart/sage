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

import getTestData from "../../englishTestSet.js";
import { Feature } from "../../../src/features/Feature.js";
import { NPPhraseSpec } from "../../../src/phrasespec/NPPhraseSpec.js";
import { VPPhraseSpec } from "../../../src/phrasespec/VPPhraseSpec.js";

describe("Elision Test", () => {
  let d: ReturnType<typeof getTestData>,
    f: ReturnType<typeof getTestData>["context"]["factory"],
    realiser: ReturnType<typeof getTestData>["realiser"],
    np4: NPPhraseSpec,
    np5: NPPhraseSpec,
    kiss: VPPhraseSpec;

  beforeEach(() => {
    d = getTestData();
    f = d.context.factory;
    realiser = d.realiser;
    // create noun phrases representing "the rock" and "the curtain"
    np4 = f.createNounPhraseDetNoun("the", "rock");
    np5 = f.createNounPhraseDetNoun("the", "curtain");
    // create a verb phrase "kiss"
    kiss = f.createVerbPhrase("kiss");
    kiss.clearComplements();
    // ensure no elision is set initially
    np4.features[Feature.ELIDED] = false;
    np5.features[Feature.ELIDED] = false;
    kiss.features[Feature.ELIDED] = false;
  });

  test("Phrase Elision", () => {
    const s1 = f.createClause({
      subject: np4,
      verbPhrase: kiss,
    });
    kiss.clearComplements();
    kiss.setComplement(np5);

    // initial: should realise as "the rock kisses the curtain"
    expect(realiser.realise(s1).realisation).toBe(
      "the rock kisses the curtain",
    );

    // elide subject NP: expected output "kisses the curtain"
    np4.features[Feature.ELIDED] = true;
    expect(realiser.realise(s1).realisation).toBe("kisses the curtain");

    // reset subject, elide VP: expected "the rock"
    np4.features[Feature.ELIDED] = false;
    kiss.features[Feature.ELIDED] = true;
    expect(realiser.realise(s1).realisation).toBe("the rock");

    // reset VP, then elide complement NP: expected "the rock kisses"
    kiss.features[Feature.ELIDED] = false;
    np5.features[Feature.ELIDED] = true;
    expect(realiser.realise(s1).realisation).toBe("the rock kisses");
  });

  test("Word Elision Test", () => {
    // Corresponds to the active Java test wordElisionTest
    np4.features[Feature.ELIDED] = false;
    np5.features[Feature.ELIDED] = false;
    kiss.features[Feature.ELIDED] = false;

    const s1 = f.createClause({
      subject: np4,
      verbPhrase: kiss,
    });
    kiss.clearComplements();
    kiss.setComplement(np5);

    np5.features[Feature.ELIDED] = true;
    expect(realiser.realise(s1).realisation).toBe("the rock kisses");
  });

  test("Word Elision (Head) Test", () => {
    // Corresponds to the commented-out testWordElision in Java
    np4.features[Feature.ELIDED] = false;
    np5.features[Feature.ELIDED] = false;
    kiss.features[Feature.ELIDED] = false;

    const s1 = f.createClause({
      subject: np4,
      verbPhrase: kiss,
    });
    kiss.clearComplements();
    kiss.setComplement(np5);
    // elide the head word of the VP (assuming kiss.verb is the head)
    if (kiss.verb && kiss.verb.features) {
      kiss.verb.features[Feature.ELIDED] = true;
    }
    expect(realiser.realise(s1).realisation).toBe(
      "the rock kisses the curtain",
    );
  });
});
