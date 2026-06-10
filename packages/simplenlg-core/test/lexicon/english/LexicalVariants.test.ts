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
import getDataSet from "../../englishTestSet.js";
import { NumberAgreement } from "../../../src/features/NumberAgreement.js";
import { Feature } from "../../../src/features/Feature.js";
import { LexicalCategory } from "../../../src/framework/LexicalCategory.js";
import { Inflection } from "../../../src/features/Inflection.js";

describe("Lexical Variants", () => {
  let s: ReturnType<typeof getDataSet>;
  let realiser: ReturnType<typeof getDataSet>["realiser"];
  let context: ReturnType<typeof getDataSet>["context"];
  // let lexicon: ReturnType<typeof getDataSet>["context"]["lexicon"];

  beforeEach(() => {
    s = getDataSet();
    realiser = s.realiser;
    context = s.context;
    // lexicon = context.lexicon;
  });

  // TODO (later): The uncommented tests don't work in the Java code either without using the NIH database, this can be resolved later if needed
  // test("Spelling Variants", () => {
  //   const asd = lexicon.getWord("Adams-Stokes disease");
  //   const spellVars = asd.features[LexicalFeature.SPELL_VARS];
  //   expect(spellVars?.includes("Adams Stokes disease")).toBe(true);
  //   expect(spellVars?.includes("Adam-Stokes disease")).toBe(true);
  //   expect(spellVars?.length).toBe(2);
  //   expect(asd.baseForm).toBe(asd.features[LexicalFeature.DEFAULT_SPELL]);

  //   // default spell variant is baseform
  //   expect(asd.defaultInflectionalVariant).toBe("Adams-Stokes disease");

  //   // default spell variant changes
  //   asd.defaultSpellingVariant = "Adams Stokes disease";
  //   expect(asd.defaultInflectionalVariant).toBe("Adams Stokes disease");
  // });

  // test("Spelling Variants With Inflection", () => {
  //   const word = lexicon.getWord("formalization");
  //   const spellVars = word.features[LexicalFeature.SPELL_VARS] as string[];
  //   expect(spellVars.includes("formalisation")).toBe(true);
  //   expect(word.defaultInflectionalVariant).toBe(Inflection.REGULAR);

  //   // create with default spelling
  //   const np = context.factory.createNounPhraseDetNoun("the", word);
  //   np.features[Feature.NUMBER] = NumberAgreement.PLURAL;
  //   expect(realiser.realise(np).realisation).toBe("the formalizations");

  //   // reset spell var
  //   word.defaultSpellingVariant = "formalisation";
  //   expect(realiser.realise(np).realisation).toBe("the formalisations");

  //   expect(word.defaultSpellingVariant).toBe("formalisation");
  // });

  // test("Verb Inflectional Variants", () => {
  //   const word = lexicon.getWord("lie", LexicalCategory.VERB);
  //   expect(word.defaultInflectionalVariant).toBe(Inflection.REGULAR);

  //   // default past is "lied"
  //   const infl = context.factory.createInflectedWord(word, word.category);
  //   infl.features[Feature.TENSE] = Tense.PAST;
  //   let past = realiser.realise(infl).realisation;
  //   expect(past).toBe("lied");

  //   // switch to irregular
  //   word.defaultInflectionalVariant = Inflection.IRREGULAR;
  //   const infl2 = context.factory.createInflectedWord(word, word.category);
  //   infl2.features[Feature.TENSE] = Tense.PAST;
  //   past = realiser.realise(infl2).realisation;
  //   expect(past).toBe("lay");

  //   // switch back to regular
  //   word.defaultInflectionalVariant = Inflection.REGULAR;
  //   expect(word.features[LexicalFeature.PAST]).toBeUndefined();
  //   const infl3 = context.factory.createInflectedWord(word, word.category);
  //   infl3.features[Feature.TENSE] = Tense.PAST;
  //   past = realiser.realise(infl3).realisation;
  //   expect(past).toBe("lied");
  // });

  // test("Noun Inflectional Variants", () => {
  //   const word = lexicon.getWord("sanctum", LexicalCategory.NOUN);
  //   expect(word.defaultInflectionalVariant).toBe(Inflection.REGULAR);

  //   // reg plural shouldn't be stored
  //   expect(word.features[LexicalFeature.PLURAL]).toBeUndefined();
  //   const infl = context.factory.createInflectedWord(word, word.category);
  //   infl.features[Feature.NUMBER] = NumberAgreement.PLURAL;
  //   let plur = realiser.realise(infl).realisation;
  //   expect(plur).toBe("sanctums");

  //   // switch to glreg
  //   word.defaultInflectionalVariant = Inflection.GRECO_LATIN_REGULAR;
  //   const infl2 = context.factory.createInflectedWord(word, word.category);
  //   infl2.features[Feature.NUMBER] = NumberAgreement.PLURAL;
  //   plur = realiser.realise(infl2).realisation;
  //   expect(plur).toBe("sancta");

  //   // and back to reg
  //   word.defaultInflectionalVariant = Inflection.REGULAR;
  //   const infl3 = context.factory.createInflectedWord(word, word.category);
  //   infl3.features[Feature.NUMBER] = NumberAgreement.PLURAL;
  //   plur = realiser.realise(infl3).realisation;
  //   expect(plur).toBe("sanctums");
  // });

  // test("Spelling Variants In Noun Phrase", () => {
  //   const asd = lexicon.getWord("Adams-Stokes disease");
  //   expect(asd.defaultSpellingVariant).toBe("Adams-Stokes disease");
  //   const np = context.factory.createNounPhrase(asd);
  //   np.specifier = lexicon.getWord("the");
  //   expect(realiser.realise(np).realisation).toBe("the Adams-Stokes disease");

  //   // change spelling var
  //   asd.defaultSpellingVariant = "Adams Stokes disease";
  //   expect(asd.defaultSpellingVariant).toBe("Adams Stokes disease");
  //   expect(realiser.realise(np).realisation).toBe("the Adams Stokes disease");

  //   //default infl for this word is uncount
  //   np.features[Feature.NUMBER] = NumberAgreement.PLURAL;
  //   expect(realiser.realise(np).realisation).toBe("the Adams Stokes disease");

  //   //change default infl for this word
  //   asd.defaultInflectionalVariant = Inflection.REGULAR;
  //   expect(realiser.realise(np).realisation).toBe("the Adams Stokes diseases");
  // });

  // test("Spelling Variants In Verb Phrase", () => {
  //   const eth = context.factory.createWord("etherise", LexicalCategory.VERB);
  //   expect(eth.defaultSpellingVariant).toBe("etherize");
  //   eth.defaultSpellingVariant = "etherise";
  //   expect(eth.defaultSpellingVariant).toBe("etherise");
  //   const s = context.factory.createClause(
  //     context.factory.createNounPhraseDetNoun("the", "doctor"),
  //     eth,
  //     context.factory.createNounPhrase("the patient"),
  //   );
  //   expect(realiser.realise(s).realisation).toBe(
  //     "the doctor etherises the patient",
  //   );
  // });

  test("Uncount Inflectional Variants", () => {
    const calc = context.factory.createWord(
      "calcification",
      LexicalCategory.NOUN,
    );
    const theCalc = context.factory.createNounPhraseDetNoun("the", calc);
    theCalc.features[Feature.NUMBER] = NumberAgreement.PLURAL;

    const r1 = realiser.realise(theCalc).realisation;
    expect(r1).toBe("the calcifications");

    calc.defaultInflectionalVariant = Inflection.UNCOUNT;
    const theCalc2 = context.factory.createNounPhraseDetNoun("the", calc);
    theCalc2.features[Feature.NUMBER] = NumberAgreement.PLURAL;
    const r2 = realiser.realise(theCalc2).realisation;
    expect(r2).toBe("the calcification");
  });
});
