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
import { LexicalCategory } from "../../../src/framework/LexicalCategory.js";
import { Realiser } from "../../../src/index.js";
import getTestData from "../../englishTestSet.js";

describe("StringElement Test", () => {
  let f: NLGFactory, realiser: Realiser, d: ReturnType<typeof getTestData>;

  beforeEach(() => {
    d = getTestData();
    f = d.context.factory;
    realiser = d.realiser;
  });

  test("String Element as Head", () => {
    // NP with StringElement head and a determiner
    const np = f.createNounPhrase("PLACEHOLDER");
    np.head = f.createStringElement("dogs and cats");
    np.specifier = f.createWord("the", LexicalCategory.DETERMINER);
    expect(realiser.realise(np).realisation).toBe("the dogs and cats");
  });

  test("String Element as Verb Phrase", () => {
    const s = f.createClause({
      subject: f.createStringElement("the big fat man"),
      verbPhrase: f.createStringElement("eats and drinks"),
    });
    expect(realiser.realise(s).realisation).toBe(
      "the big fat man eats and drinks",
    );
  });

  test("Tail NP String Element", () => {
    const senSpec = f.createClause({});
    senSpec.addComplement(f.createStringElement("mary loves"));
    const np = f.createNounPhraseDetNoun("the", "cow");
    np.head = f.createStringElement("cow");
    np.determiner = f.createStringElement("the");
    senSpec.addComplement(np);
    const sentence = f.createSentence(senSpec);
    expect(realiser.realise(sentence).realisation).toBe("Mary loves the cow.");
  });

  test("Front Noun Phrase String Element", () => {
    const senSpec = f.createClause({});
    const np = f.createNounPhraseDetNoun("the", "cat");
    np.head = f.createStringElement("cat");
    np.specifier = "the";
    senSpec.addComplement(np);
    senSpec.addComplement(f.createStringElement("loves a dog"));
    const sentence = f.createSentence(senSpec);
    expect(realiser.realise(sentence).realisation).toBe("The cat loves a dog.");
  });

  test("Multiple String Elements Test", () => {
    const senSpec = f.createClause({});
    senSpec.addComplement(f.createStringElement("the world loves"));
    const np = f.createNounPhrase("PLACEHOLDER");
    np.head = f.createStringElement("ABBA");
    senSpec.addComplement(np);
    senSpec.addComplement(f.createStringElement("but not a sore loser"));
    const sentence = f.createSentence(senSpec);
    expect(realiser.realise(sentence).realisation).toBe(
      "The world loves ABBA but not a sore loser.",
    );
  });

  test("Multiple NP Elements Test", () => {
    const senSpec = f.createClause({});
    const frontNoun = f.createNounPhrase("PLACEHOLDER");
    frontNoun.head = f.createStringElement("john");
    senSpec.addComplement(frontNoun);
    senSpec.addComplement(f.createStringElement("is a trier"));
    const backNoun = f.createNounPhrase("PLACEHOLDER");
    backNoun.specifier = "for";
    backNoun.noun = "cheese";
    senSpec.addComplement(backNoun);
    const sentence = f.createSentence(senSpec);
    expect(realiser.realise(sentence).realisation).toBe(
      "John is a trier for cheese.",
    );
  });

  test("White Space NP", () => {
    const senSpec = f.createClause({});
    const firstNoun = f.createNounPhrase("PLACEHOLDER");
    firstNoun.specifier = "the";
    firstNoun.noun = "Nasdaq";
    senSpec.addComplement(firstNoun);
    senSpec.addComplement(f.createStringElement(" rose steadily during "));
    const secondNoun = f.createNounPhrase("PLACEHOLDER");
    secondNoun.specifier = "early";
    secondNoun.noun = "trading";
    senSpec.addComplement(secondNoun);
    senSpec.addComplement(
      f.createStringElement(" , however it plummeted due to"),
    );
    const thirdNoun = f.createNounPhrase("PLACEHOLDER");
    thirdNoun.specifier = "a";
    thirdNoun.noun = "shock";
    senSpec.addComplement(thirdNoun);
    senSpec.addComplement(f.createStringElement(" after "));
    const fourthNoun = f.createNounPhrase("PLACEHOLDER");
    fourthNoun.noun = "IBM";
    senSpec.addComplement(fourthNoun);
    senSpec.addComplement(f.createStringElement("announced poor    "));
    const fifthNoun = f.createNounPhrase("PLACEHOLDER");
    fifthNoun.specifier = "first quarter";
    fifthNoun.noun = "results";
    fifthNoun.plural = true;
    senSpec.addComplement(fifthNoun);
    const sentence = f.createSentence(senSpec);
    expect(realiser.realise(sentence).realisation).toBe(
      "The Nasdaq rose steadily during early trading, however it plummeted due to a shock after IBM announced poor first quarter results.",
    );
  });

  test("Point Absorption", () => {
    const senSpec = f.createClause({});
    const firstNoun = f.createNounPhrase("PLACEHOLDER");
    firstNoun.head = f.createStringElement("yaha");
    senSpec.addComplement(firstNoun);
    senSpec.addComplement(
      f.createStringElement("was sleeping on his own and dreaming etc."),
    );
    const sentence = f.createSentence(senSpec);
    expect(realiser.realise(sentence).realisation).toBe(
      "Yaha was sleeping on his own and dreaming etc.",
    );
  });

  test("Point Absorption Trailing White Space", () => {
    const senSpec = f.createClause({});
    const firstNoun = f.createNounPhrase("PLACEHOLDER");
    firstNoun.head = f.createStringElement("yaha");
    senSpec.addComplement(firstNoun);
    senSpec.addComplement(
      f.createStringElement("was sleeping on his own and dreaming etc."),
    );
    const sentence = f.createSentence(senSpec);
    expect(realiser.realise(sentence).realisation).toBe(
      "Yaha was sleeping on his own and dreaming etc.",
    );
  });

  test("Middle Abbreviation", () => {
    const senSpec = f.createClause({});
    const firstNoun = f.createNounPhrase("PLACEHOLDER");
    firstNoun.head = f.createStringElement("yahya");
    senSpec.addComplement(firstNoun);
    senSpec.addComplement(f.createStringElement("and friends etc. went to"));
    const secondNoun = f.createNounPhrase("PLACEHOLDER");
    secondNoun.head = f.createStringElement("the");
    secondNoun.specifier = "the";
    secondNoun.noun = "park";
    senSpec.addComplement(secondNoun);
    senSpec.addComplement(f.createStringElement("to play"));
    const sentence = f.createSentence(senSpec);
    expect(realiser.realise(sentence).realisation).toBe(
      "Yahya and friends etc. went to the park to play.",
    );
  });

  test("String Indefinite Article Inflection Vowel Test", () => {
    const senSpec = f.createClause({});
    senSpec.addComplement(f.createStringElement("I see a"));
    const firstNoun = f.createNounPhrase("elephant");
    senSpec.addComplement(firstNoun);
    const sentence = f.createSentence(senSpec);
    expect(realiser.realise(sentence).realisation).toBe("I see an elephant.");
  });

  test("NP Indefinite Article Inflection Vowel Test", () => {
    const senSpec = f.createClause({});
    senSpec.addComplement(f.createStringElement("I see"));
    const firstNoun = f.createNounPhrase("elephant");
    firstNoun.specifier = "a";
    senSpec.addComplement(firstNoun);
    const sentence = f.createSentence(senSpec);
    expect(realiser.realise(sentence).realisation).toBe("I see an elephant.");
  });

  test("String Indefinite Article Inflection Consonant Test", () => {
    const senSpec = f.createClause({});
    senSpec.addComplement(f.createStringElement("I see an"));
    const firstNoun = f.createNounPhrase("cow");
    senSpec.addComplement(firstNoun);
    const completeSen = f.createSentence();
    completeSen.addComponent(senSpec);
    // Do not attempt "an" -> "a"
    expect(realiser.realise(completeSen).realisation)./*not.*/ toBe(
      "I see an cow.",
    ); // The original test is incorrect, it checks Strings for equality, which need special treament in Java.
  });

  test("NP Indefinite Article Inflection Consonant Test", () => {
    const senSpec = f.createClause({});
    senSpec.addComplement(f.createStringElement("I see"));
    const firstNoun = f.createNounPhrase("cow");
    firstNoun.specifier = "an";
    senSpec.addComplement(firstNoun);
    const sentence = f.createSentence(senSpec);
    // Do not attempt "an" -> "a"
    expect(realiser.realise(sentence).realisation).toBe("I see an cow.");
  });

  test("Aggregation String ElementTest", () => {
    const coord = f.createCoordinatedPhrase(
      f.createStringElement("John is going to Tesco"),
      f.createStringElement("Mary is going to Sainsburys"),
    );
    const senSpec = f.createClause({});
    senSpec.addComplement(coord);
    const sentence = f.createSentence(senSpec);
    expect(realiser.realise(sentence).realisation).toBe(
      "John is going to Tesco and Mary is going to Sainsburys.",
    );
  });

  test("Null And Empty String Element Test", () => {
    const emptyStringElement = f.createStringElement(""); // Conversion note: We dont allow null StringElements, so we only test empty string
    const beautiful = f.createStringElement("beautiful");
    const horseLike = f.createStringElement("horse-like");
    const creature = f.createStringElement("creature");

    // Test1: null or empty at beginning
    let senSpec = f.createClause("a unicorn", "be", "regarded as a");
    senSpec.addPostModifier(emptyStringElement);
    senSpec.addPostModifier(beautiful);
    senSpec.addPostModifier(horseLike);
    senSpec.addPostModifier(creature);
    expect(realiser.realiseSentence(senSpec)).toBe(
      "A unicorn is regarded as a beautiful horse-like creature.",
    );

    // Test2: empty or null at end
    senSpec = f.createClause("a unicorn", "be", "regarded as a");
    senSpec.addPostModifier(beautiful);
    senSpec.addPostModifier(horseLike);
    senSpec.addPostModifier(creature);
    senSpec.addPostModifier(emptyStringElement);
    expect(realiser.realiseSentence(senSpec)).toBe(
      "A unicorn is regarded as a beautiful horse-like creature.",
    );

    // Test3: empty or null in the middle
    senSpec = f.createClause("a unicorn", "be", "regarded as a");
    senSpec.addPostModifier("beautiful");
    senSpec.addPostModifier("horse-like");
    senSpec.addPostModifier("");
    senSpec.addPostModifier("creature");
    expect(realiser.realiseSentence(senSpec)).toBe(
      "A unicorn is regarded as a beautiful horse-like creature.",
    );

    // Test4: empty or null in the middle with empty or null at beginning
    senSpec = f.createClause("a unicorn", "be", "regarded as a");
    senSpec.addPostModifier("");
    senSpec.addPostModifier("beautiful");
    senSpec.addPostModifier("horse-like");
    senSpec.addPostModifier(emptyStringElement);
    senSpec.addPostModifier("creature");
    expect(realiser.realiseSentence(senSpec)).toBe(
      "A unicorn is regarded as a beautiful horse-like creature.",
    );
  });
});
