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

import { Feature } from "../../../src/features/Feature";
import { NumberAgreement } from "../../../src/features/NumberAgreement";
import { Tense } from "../../../src/features/Tense";
import { Realiser } from "../../../src/realiser/english/Realiser";
import getDataSet from "../../englishTestSet";
import { Lexicon } from "../../../src/lexicon/Lexicon";
import { NLGFactory } from "../../../src/factory/NLGFactory";
import { LexicalCategory } from "../../../src/framework/LexicalCategory";
import { Inflection } from "../../../src/features/Inflection";
import { LexicalFeature } from "../../../src/features/LexicalFeature";
describe("XMLLexicon", () => {
  let d: ReturnType<typeof getDataSet>;
  let lexicon: Lexicon;
  let realiser: Realiser;
  let f: NLGFactory;
  beforeEach(() => {
    d = getDataSet();
    lexicon = d.context.lexicon;
    realiser = d.realiser;
    f = d.context.factory;
  });

  test("basic Lexicon Tests", () => {
    // test getWords. Should be 2 "can" (of any cat), 1 noun tree, 0 adj
    // trees
    expect(lexicon.getWords("can", LexicalCategory.ANY).length).toBe(3);
    expect(lexicon.getWords("can", LexicalCategory.NOUN).length).toBe(1);
    expect(lexicon.getWords("can", LexicalCategory.ADJECTIVE).length).toBe(0);

    // below test removed as standard morph variants no longer recorded in
    // lexicon
    // WordElement early = lexicon.getWord("early",
    // LexicalCategory.ADJECTIVE);
    // Assert.assertEquals("earlier",
    // early.getFeatureAsString(Feature.COMPARATIVE));

    // test getWord. Comparative of ADJ "good" is "better", superlative is
    // "best", this is a qualitative and predicative adjective
    const good = lexicon.getWord("good", LexicalCategory.ADJECTIVE);
    expect(good?.features[LexicalFeature.COMPARATIVE]).toBe("better");
    expect(good?.features[LexicalFeature.SUPERLATIVE]).toBe("best");
    expect(good?.features[LexicalFeature.QUALITATIVE]).toBe(true);
    expect(good?.features[LexicalFeature.PREDICATIVE]).toBe(true);
    expect(good?.features[LexicalFeature.COLOUR]).toBeFalsy();
    expect(good?.features[LexicalFeature.CLASSIFYING]).toBeFalsy();

    // test getWord. There is only one "woman", and its plural is "women".
    // It is not an acronym, not proper, and countable
    const woman = lexicon.getWord("woman");

    expect(woman?.features[LexicalFeature.PLURAL]).toBe("women");
    expect(woman?.features[LexicalFeature.ACRONYM_OF]).toBe(undefined);
    expect(woman?.features[LexicalFeature.PROPER]).toBeFalsy();
    expect(woman?.hasInflectionalVariant(Inflection.UNCOUNT)).toBeFalsy();

    // NB: This fails if the lexicon is XMLLexicon. No idea why.
    // Assert.assertEquals("irreg",
    // woman.getFeatureAsString(LexicalFeature.DEFAULT_INFL));

    // test getWord. Noun "sand" is non-count
    const sand = lexicon.getWord("sand", LexicalCategory.NOUN);
    expect(sand?.hasInflectionalVariant(Inflection.UNCOUNT)).toBe(true);
    expect(sand?.defaultInflectionalVariant).toBe(Inflection.UNCOUNT);

    // test hasWord
    expect(lexicon.hasWord("tree")).toBe(true); // "tree" exists
    expect(lexicon.hasWord("tree", LexicalCategory.ADVERB)).toBe(false); // but not as an adverb

    // test getWordByID; quickly, also check that this is a verb_modifier
    const quickly = lexicon.getWordByID("E0051632");
    expect(quickly?.baseForm).toBe("quickly");
    expect(quickly?.category).toBe(LexicalCategory.ADVERB);
    expect(quickly?.features[LexicalFeature.VERB_MODIFIER]).toBe(true);
    expect(quickly?.features[LexicalFeature.SENTENCE_MODIFIER]).toBeFalsy();
    expect(quickly?.features[LexicalFeature.INTENSIFIER]).toBeFalsy();

    // test getWordFromVariant, verb type (tran or intran, not ditran)
    const eat = lexicon.getWordFromVariant("eating");
    expect(eat?.baseForm).toBe("eat");
    expect(eat?.category).toBe(LexicalCategory.VERB);
    expect(eat?.features[LexicalFeature.INTRANSITIVE]).toBe(true);
    expect(eat?.features[LexicalFeature.TRANSITIVE]).toBe(true);
    expect(eat?.features[LexicalFeature.DITRANSITIVE]).toBeFalsy();

    // test BE is handled OK
    expect(
      lexicon.getWordFromVariant("is", LexicalCategory.VERB)?.features[
        LexicalFeature.PAST_PARTICIPLE
      ],
    ).toBe("been");

    // test modal
    const can = lexicon.getWord("can", LexicalCategory.MODAL);
    expect(can?.features[LexicalFeature.PAST]).toBe("could");

    // test non-existent word
    expect(lexicon.getWords("akjmchsgk", LexicalCategory.ANY).length).toBe(0);

    // test lookup word method
    expect(lexicon.lookupWord("say", LexicalCategory.VERB)?.baseForm).toBe(
      "say",
    );
    expect(lexicon.lookupWord("said", LexicalCategory.VERB)?.baseForm).toBe(
      "say",
    );
    expect(lexicon.lookupWord("E0054448", LexicalCategory.VERB)?.baseForm).toBe(
      "say",
    );
  });

  test("xml Lexicon Immutability Test", () => {
    // "wall" is singular.
    const wall = f.createNounPhraseDetNoun("the", "wall");
    expect(wall.features[Feature.NUMBER]).toBe(NumberAgreement.SINGULAR);

    // Realise a sentence with plural form of "wall"
    wall.plural = true;
    const sentence = f.createClause("motion", "observe");
    sentence.features[Feature.TENSE] = Tense.PAST;
    const pp = f.createPrepositionPhrase("in", wall);
    sentence.addPostModifier(pp);
    realiser.realiseSentence(sentence);

    // Create a new 'the wall' NP and check to make sure that the syntax processor has
    // not propagated plurality to the canonical XMLLexicon WordElement object.
    const wall2 = f.createNounPhraseDetNoun("the", "wall");
    expect(wall2.features[Feature.NUMBER]).toBe(NumberAgreement.SINGULAR);
  });
});

