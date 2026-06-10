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
import { defaultEnglishContext } from "../../../src/factory/NLGContext.js";
import { Realiser } from "../../../src/realiser/english/Realiser.js";
import { NLGElement } from "../../../src/framework/NLGElement.js";
import { Feature } from "../../../src/features/Feature.js";
import { Form } from "../../../src/features/Form.js";
import { LexicalCategory } from "../../../src/framework/LexicalCategory.js";
import { LexicalFeature } from "../../../src/features/LexicalFeature.js";
import { Gender } from "../../../src/features/Gender.js";
describe("Realiser", () => {
  // setup for all tests in this describe blockd
  const context = defaultEnglishContext;
  const realiser = Realiser.create(context);

  test("Test the realization of List of NLGElements that is null", () => {
    const elements: NLGElement[] = [];
    const realisedElements = realiser.realiseAll(elements);
    // Expect empty list returned:
    expect(realisedElements.length).toBe(0);
  });

  test("Test the realization of multiple NLGElements in a list.", () => {
    const elements: NLGElement[] = [];

    // "The cat jumping on the counter."
    const sentence1 = context.factory.createSentence();
    const subject1 = context.factory.createNounPhraseDetNoun("the", "cat");
    const verb1 = context.factory.createVerbPhrase("jump");
    verb1.features[Feature.FORM] = Form.PRESENT_PARTICIPLE;
    const object1 = context.factory.createNounPhraseDetNoun("the", "counter");
    const prep1 = context.factory.createPrepositionPhrase("on", object1);
    const clause1 = context.factory.createClause(subject1, verb1, prep1);
    sentence1.addComponent(clause1);

    // "The dog running on the counter."
    const sentence2 = context.factory.createSentence();
    const subject2 = context.factory.createNounPhraseDetNoun("the", "dog");
    subject2.determiner = "the";
    const verb2 = context.factory.createVerbPhrase("run");
    verb2.features[Feature.FORM] = Form.PRESENT_PARTICIPLE;
    const object2 = context.factory.createNounPhraseDetNoun("the", "counter");
    object2.determiner = "the";
    const prep2 = context.factory.createPrepositionPhrase("on", object2);
    const clause2 = context.factory.createClause(subject2, verb2, prep2);
    sentence2.addComponent(clause2);

    elements.push(sentence1, sentence2);
    const realisedElements = realiser.realiseAll(elements);

    expect(realisedElements.length).toBe(2);
    expect(realisedElements[0]?.realisation).toBe(
      "The cat jumping on the counter.",
    );
    expect(realisedElements[1]?.realisation).toBe(
      "The dog running on the counter.",
    );
  });

  test("Test the correct pluralization with possessives", () => {
    const sisterNP = context.factory.createNounPhrase("sister");
    const word = context.factory.createWord(
      "Albert Einstein",
      LexicalCategory.NOUN,
    );
    word.features[LexicalFeature.PROPER] = true;
    const possNP = context.factory.createNounPhrase(word);
    possNP.features[Feature.POSSESSIVE] = true;
    sisterNP.specifier = possNP;
    expect(realiser.realise(sisterNP).realisation).toBe(
      "Albert Einstein's sister",
    );
    sisterNP.plural = true;
    expect(realiser.realise(sisterNP).realisation).toBe(
      "Albert Einstein's sisters",
    );
    sisterNP.plural = false;
    possNP.features[LexicalFeature.GENDER] = Gender.MASCULINE;
    possNP.features[Feature.PRONOMINAL] = true;
    expect(realiser.realise(sisterNP).realisation).toBe("his sister");
    sisterNP.plural = true;
    expect(realiser.realise(sisterNP).realisation).toBe("his sisters");

    const wordAlt = context.factory.createWord(
      "Pythagoras",
      LexicalCategory.NOUN,
    );
    wordAlt.features[LexicalFeature.PROPER] = true;
    const possNPAlt = context.factory.createNounPhrase(wordAlt);
    possNPAlt.features[Feature.POSSESSIVE] = true;
    sisterNP.specifier = possNPAlt;
    sisterNP.plural = false;
    expect(realiser.realise(sisterNP).realisation).toBe("Pythagoras' sister");
    sisterNP.plural = true;
    expect(realiser.realise(sisterNP).realisation).toBe("Pythagoras' sisters");
  });
});
