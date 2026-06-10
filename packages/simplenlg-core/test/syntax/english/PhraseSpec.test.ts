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
import { WordElement } from "../../../src/framework/WordElement.js";
import { NLGElement } from "../../../src/framework/NLGElement.js";
import { InflectedWordElement } from "../../../src/framework/InflectedWordElement.js";
import { PhraseElement } from "../../../src/framework/PhraseElement.js";
import { StringElement } from "../../../src/framework/StringElement.js";

function getBaseForm(constituent: NLGElement | undefined): string | null {
  if (!constituent) return null;
  // if (typeof constituent === "string") return constituent;
  if (constituent instanceof StringElement) return constituent.realisation;
  if (constituent instanceof WordElement) return constituent.baseForm;
  if (constituent instanceof InflectedWordElement)
    return getBaseForm(constituent.baseWord);
  if (constituent instanceof PhraseElement)
    return getBaseForm(constituent.head);
  return null;
}

describe("PhraseSpec", () => {
  let f: NLGFactory, realiser: Realiser, d: ReturnType<typeof getTestData>;

  beforeEach(() => {
    d = getTestData();
    f = d.context.factory;
    realiser = d.realiser;
  });

  test("Empty Phrase Realisation", () => {
    const emptyClause = f.createClause({});
    expect(realiser.realise(emptyClause).realisation).toBe("");
  });

  test("SPhrase Spec", () => {
    const c1 = f.createClause({
      verb: "give",
      subject: "John",
      directObject: "an apple",
      indirectObject: "Mary",
    });
    c1.features[Feature.TENSE] = Tense.PAST;
    c1.features[Feature.NEGATED] = true;

    // Check getter base forms
    expect(getBaseForm(c1.verb)).toBe("give");
    expect(getBaseForm(c1.getSubject())).toBe("John");
    expect(getBaseForm(c1.getObject())).toBe("an apple");
    expect(getBaseForm(c1.getIndirectObject())).toBe("Mary");

    expect(realiser.realise(c1).realisation).toBe(
      "John did not give Mary an apple",
    );

    // test modifier placement
    const c2 = f.createClause({
      verb: "see",
      subject: "the man",
      directObject: "me",
    });
    c2.addModifier("fortunately");
    c2.addModifier("quickly");
    c2.addModifier("in the park");
    c2.features[Feature.TENSE] = Tense.PAST;

    expect(realiser.realise(c2).realisation).toBe(
      "fortunately the man quickly saw me in the park",
    );
  });
});
