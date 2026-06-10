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

import { Feature } from "../../../src/features/Feature.js";
import { LexicalCategory } from "../../../src/framework/LexicalCategory.js";
import set from "../../englishTestSet.js";

describe("Adjvect Phrase", () => {
  let s: ReturnType<typeof set>;
  let realiser: ReturnType<typeof set>["realiser"];
  let context: ReturnType<typeof set>["context"];

  beforeEach(() => {
    // TODO (later): There is no explicit contract that we never change variables, so we do before each.
    s = set();
    realiser = s.realiser;
    context = s.context;
  });

  test("Adjectives", () => {
    const { realiser, context } = s;
    s.adj.salacious.addPreModifier("incredibly");
    expect(realiser.realise(s.adj.salacious).realisation).toBe(
      "incredibly salacious",
    );
    s.adj.beautiful.addPreModifier("amazingly");
    expect(realiser.realise(s.adj.beautiful).realisation).toBe(
      "amazingly beautiful",
    );
    const coordap = context.factory.createCoordinatedPhrase(
      s.adj.salacious,
      s.adj.beautiful,
    );
    expect(realiser.realise(coordap).realisation).toBe(
      "incredibly salacious and amazingly beautiful",
    );
    coordap.features[Feature.CONJUNCTION] = "or";
    expect(realiser.realise(coordap).realisation).toBe(
      "incredibly salacious or amazingly beautiful",
    );
    const coord2 = context.factory.createCoordinatedPhrase(
      coordap,
      s.adj.stunning,
    );
    expect(realiser.realise(coord2).realisation).toBe(
      "incredibly salacious or amazingly beautiful and stunning",
    );
    const preMod = context.factory.createCoordinatedPhrase(
      context.factory.createStringElement("seriously"),
      context.factory.createStringElement("undeniably"),
    );
    coord2.addPreModifier(preMod);
    expect(realiser.realise(coord2).realisation).toBe(
      "seriously and undeniably incredibly salacious or amazingly beautiful and stunning",
    );
    coordap.addCoordinate(s.adj.stunning);
    expect(realiser.realise(coordap).realisation).toBe(
      "incredibly salacious, amazingly beautiful or stunning",
    );
  });

  test("Adverbs", () => {
    const sent = context.factory.createClause("John", "eat");
    const adv = context.factory.createAdverbPhrase("quickly");
    sent.addPreModifier(adv);
    expect(realiser.realise(sent).realisation).toBe("John quickly eats");
    adv.addPreModifier("very");
    expect(realiser.realise(sent).realisation).toBe("John very quickly eats");
  });

  test("Participle Adjectives", () => {
    const ap = context.factory.createAdjectivePhrase(
      context.lexicon.getWord("associated", LexicalCategory.ADJECTIVE),
    );
    expect(realiser.realise(ap).realisation).toBe("associated");
  });

  test("Multiple Modifiers", () => {
    const np = context.factory.createNounPhrase(
      context.lexicon.getWord("message", LexicalCategory.NOUN),
    );
    np.addPreModifier(
      context.lexicon.getWord("active", LexicalCategory.ADJECTIVE),
    );
    np.addPreModifier(
      context.lexicon.getWord("temperature", LexicalCategory.ADJECTIVE),
    );
    expect(realiser.realise(np).realisation).toBe(
      "active, temperature message",
    );
    realiser.commaSepPremodifiers = false;
    expect(realiser.realise(np).realisation).toBe("active temperature message");
  });
});
