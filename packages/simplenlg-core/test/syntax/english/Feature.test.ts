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
import { LexicalCategory } from "../../../src/framework/LexicalCategory.js";
import getTestData from "../../englishTestSet.js";

// Assuming additional phrase creation functions exist on factory (createWord, createNounPhrase, createClause, etc.)
describe("Feature", () => {
  let f: NLGFactory, realiser: Realiser, d: ReturnType<typeof getTestData>;

  beforeEach(() => {
    d = getTestData();
    f = d.context.factory;
    realiser = d.realiser;
  });

  test("Possessive Feature - Past Tense", () => {
    const she = f.createWord("she", LexicalCategory.PRONOUN);
    she.features[Feature.POSSESSIVE] = true;
    const herLover = f.createNounPhraseDetNoun(she, "lover");
    const clause = f.createClause("he", "be", herLover);
    clause.features[Feature.CUE_PHRASE] =
      f.createStringElement("after two weeks,");
    clause.addPostModifier("for a fortnight");
    clause.features[Feature.TENSE] = Tense.PAST;
    const sentence1 = f.createSentence(clause);
    expect(realiser.realise(sentence1).realisation).toBe(
      "After two weeks, he was her lover for a fortnight.",
    );
  });

  test("Two Possessive Feature - Past Tense", () => {
    const she = f.createWord("she", LexicalCategory.PRONOUN);
    she.features[Feature.POSSESSIVE] = true;
    const herLover = f.createNounPhraseDetNoun(she, "lover");
    // set plural on the noun phrase
    herLover.plural = true;
    const he = f.createNounPhrase("he", undefined, LexicalCategory.PRONOUN);
    he.plural = true;
    const clause = f.createClause(he, "be", herLover);
    clause.features[Feature.POSSESSIVE] = true;
    clause.features[Feature.CUE_PHRASE] =
      f.createStringElement("after two weeks,");
    clause.addPostModifier("for a fortnight");
    clause.features[Feature.TENSE] = Tense.PAST;
    const sentence1 = f.createSentence(clause);
    expect(realiser.realise(sentence1).realisation).toBe(
      "After two weeks, they were her lovers for a fortnight.",
    );
  });

  test("Complementiser Feature - Past Tense", () => {
    const born = f.createClause("Dave Bus", "be", "born");
    born.features[Feature.TENSE] = Tense.PAST;
    born.addPostModifier("in");
    born.features[Feature.COMPLEMENTISER] = f.createStringElement("which");
    const theHouse = f.createNounPhraseDetNoun("the", "house");
    theHouse.addComplement(born);
    const clause = f.createClause(
      theHouse,
      "be",
      f.createPrepositionPhrase("in", "Edinburgh"),
    );
    const sentence = f.createSentence(clause);
    expect(realiser.realise(sentence).realisation).toBe(
      "The house which Dave Bus was born in is in Edinburgh.",
    );
  });

  test("Complementiser Feature in a Coordinate Phrase - Past Tense", () => {
    const dave = f.createWord("Dave Bus", LexicalCategory.NOUN);
    const albert = f.createWord("Albert", LexicalCategory.NOUN);
    const coord = f.createCoordinatedPhrase(dave, albert);
    const born = f.createClause(coord, "be", "born");
    born.features[Feature.TENSE] = Tense.PAST;
    born.addPostModifier("in");
    born.features[Feature.COMPLEMENTISER] = f.createStringElement("which");
    const theHouse = f.createNounPhraseDetNoun("the", "house");
    theHouse.addComplement(born);
    const clause = f.createClause(
      theHouse,
      "be",
      f.createPrepositionPhrase("in", "Edinburgh"),
    );
    const sentence = f.createSentence(clause);
    expect(realiser.realise(sentence).realisation).toBe(
      "The house which Dave Bus and Albert were born in is in Edinburgh.",
    );
  });

  test("Progressive Complementiser Features - Future Tense", () => {
    const inner = f.createClause("I", "make", "sentence for");
    inner.features[Feature.PROGRESSIVE] = true;
    inner.features[Feature.COMPLEMENTISER] = f.createStringElement("whom");
    const engineer = f.createNounPhrase("the engineer");
    engineer.addComplement(inner);
    const outer = f.createClause(
      engineer,
      "go",
      f.createPrepositionPhrase("to", "holidays"),
    );
    outer.features[Feature.TENSE] = Tense.FUTURE;
    outer.features[Feature.PROGRESSIVE] = true;
    outer.addPostModifier("tomorrow");
    const sentence = f.createSentence(outer);
    expect(realiser.realise(sentence).realisation).toBe(
      "The engineer whom I am making sentence for will be going to holidays tomorrow.",
    );
  });

  test("Complementiser Passive Perfect Features - Past Tense", () => {
    const inner = f.createClause("I", "play", "poker");
    inner.features[Feature.TENSE] = Tense.PAST;
    inner.features[Feature.COMPLEMENTISER] = f.createStringElement("where");
    const house = f.createNounPhraseDetNoun("the", "house");
    house.addComplement(inner);
    const outer = f.createClause({
      verb: "abandon",
      directObject: house,
    });
    outer.addPostModifier("since 1986");
    outer.features[Feature.PASSIVE] = true;
    outer.features[Feature.PERFECT] = true;
    const sentence = f.createSentence(outer);
    expect(realiser.realise(sentence).realisation).toBe(
      "The house where I played poker has been abandoned since 1986.",
    );
  });

  test("Progressive Complementiser Features - Past Tense", () => {
    const sandwich = f.createNounPhrase(
      "sandwich",
      undefined,
      LexicalCategory.NOUN,
    );
    sandwich.plural = true;
    const first = f.createClause("I", "make", sandwich);
    first.features[Feature.TENSE] = Tense.PAST;
    first.features[Feature.PROGRESSIVE] = true;
    first.plural = false;
    const second = f.createClause("the mayonnaise", "run out");
    second.features[Feature.TENSE] = Tense.PAST;
    second.features[Feature.COMPLEMENTISER] = f.createStringElement("when");
    first.addComplement(second);
    const sentence = f.createSentence(first);
    expect(realiser.realise(sentence).realisation).toBe(
      "I was making sandwiches when the mayonnaise ran out.",
    );
  });

  test("Passive Feature", () => {
    const clause = f.createClause("recession", "affect", "value");
    clause.features[Feature.PASSIVE] = true;
    const sentence = f.createSentence(clause);
    expect(realiser.realise(sentence).realisation).toBe(
      "Value is affected by recession.",
    );
  });

  test("Future Tense", () => {
    const testClause = f.createClause({
      subject: f.createNounPhrase("I"),
      verbPhrase: f.createVerbPhrase("go"),
      postModifier: f.createAdverbPhrase("tomorrow"),
    });
    testClause.features[Feature.TENSE] = Tense.FUTURE;
    const sentence1 = realiser.realiseSentence(testClause);
    expect(sentence1).toBe("I will go tomorrow.");

    const test2 = f.createClause({
      subject: f.createNounPhrase("I"),
      verb: "go",
      postModifier: f.createAdverbPhrase("tomorrow"),
    });
    test2.features[Feature.TENSE] = Tense.FUTURE;
    const sentence2 = realiser.realiseSentence(test2);
    expect(sentence2).toBe("I will go tomorrow.");
  });
});
