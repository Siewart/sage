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
import { NumberAgreement } from "../../../src/features/NumberAgreement.js";
import { LexicalCategory } from "../../../src/framework/LexicalCategory.js";
import { Gender } from "../../../src/features/Gender.js";
import { Person } from "../../../src/features/Person.js";
import { InternalFeature } from "../../../src/features/InternalFeature.js";
import { DiscourseFunction } from "../../../src/features/DiscourseFunction.js";
import { LexicalFeature } from "../../../src/features/LexicalFeature.js";
import { Tense } from "../../../src/features/Tense.js";
import data from "../../englishTestSet.js";

describe("Noun Phrase Test", () => {
  let realiser: ReturnType<typeof data>["realiser"],
    proTest1: ReturnType<typeof data>["nounPhrase"]["proTest"],
    proTest2: ReturnType<typeof data>["nounPhrase"]["proTest2"],
    f: ReturnType<typeof data>["context"]["factory"];

  beforeEach(() => {
    const d = data();
    realiser = d.realiser;
    f = d.context.factory;
    proTest1 = d.nounPhrase.proTest;
    proTest2 = d.nounPhrase.proTest2;
  });

  test("Plural", () => {
    const np4 = f.createNounPhraseDetNoun("the", "rock");
    const np5 = f.createNounPhraseDetNoun("the", "curtain");

    np4.features[Feature.NUMBER] = NumberAgreement.PLURAL;
    expect(realiser.realise(np4).realisation).toBe("the rocks");

    np5.features[Feature.NUMBER] = NumberAgreement.PLURAL;
    expect(realiser.realise(np5).realisation).toBe("the curtains");

    np5.features[Feature.NUMBER] = NumberAgreement.SINGULAR;
    expect(np5.features[Feature.NUMBER]).toBe(NumberAgreement.SINGULAR);
    expect(realiser.realise(np5).realisation).toBe("the curtain");

    np5.features[Feature.NUMBER] = NumberAgreement.PLURAL;
    expect(realiser.realise(np5).realisation).toBe("the curtains");
  });

  test("Pronominalisation", () => {
    // singular
    proTest1.features[LexicalFeature.GENDER] = Gender.FEMININE;
    proTest1.features[Feature.PRONOMINAL] = true;
    expect(realiser.realise(proTest1).realisation).toBe("she");

    // singular, possessive
    proTest1.features[Feature.POSSESSIVE] = true;
    expect(realiser.realise(proTest1).realisation).toBe("her");

    // plural pronoun
    proTest2.features[Feature.NUMBER] = NumberAgreement.PLURAL;
    proTest2.features[Feature.PRONOMINAL] = true;
    expect(realiser.realise(proTest2).realisation).toBe("they");

    // accusative: "them"
    proTest2.features[InternalFeature.DISCOURSE_FUNCTION] =
      DiscourseFunction.OBJECT;
    expect(realiser.realise(proTest2).realisation).toBe("them");
  });

  test("Pronominalisation2", () => {
    let pro = f.createNounPhrase("Mary");
    pro.features[Feature.PRONOMINAL] = true;
    pro.features[Feature.PERSON] = Person.FIRST;
    let sent = f.createClause(pro, "like", "John");
    expect(realiser.realiseSentence(sent)).toBe("I like John.");

    pro = f.createNounPhrase("Mary");
    pro.features[Feature.PRONOMINAL] = true;
    pro.features[Feature.PERSON] = Person.SECOND;
    sent = f.createClause(pro, "like", "John");
    expect(realiser.realiseSentence(sent)).toBe("You like John.");

    pro = f.createNounPhrase("Mary");
    pro.features[Feature.PRONOMINAL] = true;
    pro.features[Feature.PERSON] = Person.THIRD;
    pro.features[LexicalFeature.GENDER] = Gender.FEMININE;
    sent = f.createClause(pro, "like", "John");
    expect(realiser.realiseSentence(sent)).toBe("She likes John.");

    pro = f.createNounPhrase("Mary");
    pro.features[Feature.PRONOMINAL] = true;
    pro.features[Feature.PERSON] = Person.FIRST;
    pro.plural = true;
    sent = f.createClause(pro, "like", "John");
    expect(realiser.realiseSentence(sent)).toBe("We like John.");

    pro = f.createNounPhrase("Mary");
    pro.features[Feature.PRONOMINAL] = true;
    pro.features[Feature.PERSON] = Person.SECOND;
    pro.plural = true;
    sent = f.createClause(pro, "like", "John");
    expect(realiser.realiseSentence(sent)).toBe("You like John.");

    pro = f.createNounPhrase("Mary");
    pro.features[Feature.PRONOMINAL] = true;
    pro.features[Feature.PERSON] = Person.THIRD;
    pro.plural = true;
    pro.features[LexicalFeature.GENDER] = Gender.FEMININE;
    sent = f.createClause(pro, "like", "John");
    expect(realiser.realiseSentence(sent)).toBe("They like John.");

    pro = f.createNounPhrase("John");
    pro.features[Feature.PRONOMINAL] = true;
    pro.features[Feature.PERSON] = Person.FIRST;
    sent = f.createClause("Mary", "like", pro);
    expect(realiser.realiseSentence(sent)).toBe("Mary likes me.");

    pro = f.createNounPhrase("John");
    pro.features[Feature.PRONOMINAL] = true;
    pro.features[Feature.PERSON] = Person.SECOND;
    sent = f.createClause("Mary", "like", pro);
    expect(realiser.realiseSentence(sent)).toBe("Mary likes you.");

    pro = f.createNounPhrase("John");
    pro.features[Feature.PRONOMINAL] = true;
    pro.features[Feature.PERSON] = Person.THIRD;
    pro.features[LexicalFeature.GENDER] = Gender.MASCULINE;
    sent = f.createClause("Mary", "like", pro);
    expect(realiser.realiseSentence(sent)).toBe("Mary likes him.");

    pro = f.createNounPhrase("John");
    pro.features[Feature.PRONOMINAL] = true;
    pro.features[Feature.PERSON] = Person.FIRST;
    pro.plural = true;
    sent = f.createClause("Mary", "like", pro);
    expect(realiser.realiseSentence(sent)).toBe("Mary likes us.");

    pro = f.createNounPhrase("John");
    pro.features[Feature.PRONOMINAL] = true;
    pro.features[Feature.PERSON] = Person.SECOND;
    pro.plural = true;
    sent = f.createClause("Mary", "like", pro);
    expect(realiser.realiseSentence(sent)).toBe("Mary likes you.");

    pro = f.createNounPhrase("John");
    pro.features[Feature.PRONOMINAL] = true;
    pro.features[Feature.PERSON] = Person.THIRD;
    pro.features[LexicalFeature.GENDER] = Gender.MASCULINE;
    pro.plural = true;
    sent = f.createClause("Mary", "like", pro);
    expect(realiser.realiseSentence(sent)).toBe("Mary likes them.");
  });

  test("Premodification", () => {
    const man = f.createNounPhrase("man");
    man.specifier = "the";
    const salacious = f.createWord("salacious", LexicalCategory.ADJECTIVE);

    man.addPreModifier(salacious);
    expect(realiser.realise(man).realisation).toBe("the salacious man");

    const woman = f.createNounPhrase("woman");
    woman.specifier = "the";
    const beautiful = f.createWord("beautiful", LexicalCategory.ADJECTIVE);

    woman.addPreModifier(beautiful);
    expect(realiser.realise(woman).realisation).toBe("the beautiful woman");

    const dog = f.createNounPhrase("dog");
    dog.specifier = "the";
    const stunning = f.createWord("stunning", LexicalCategory.ADJECTIVE);

    dog.addPreModifier(stunning);
    expect(realiser.realise(dog).realisation).toBe("the stunning dog");

    // premodification with a WordElement
    man.setPreModifier(f.createWord("idiotic", LexicalCategory.ADJECTIVE));
    expect(realiser.realise(man).realisation).toBe("the idiotic man");
  });

  test("Postmodification", () => {
    const man = f.createNounPhrase("man");
    man.specifier = "the";
    const onTheRock = f.createPrepositionPhrase("on", "the rock");

    man.addPostModifier(onTheRock);
    expect(realiser.realise(man).realisation).toBe("the man on the rock");

    const woman = f.createNounPhrase("woman");
    woman.specifier = "the";
    const behindTheCurtain = f.createPrepositionPhrase("behind", "the curtain");

    woman.addPostModifier(behindTheCurtain);
    expect(realiser.realise(woman).realisation).toBe(
      "the woman behind the curtain",
    );

    // postmodification with a WordElement
    man.setPostModifier(f.createWord("jack", LexicalCategory.NOUN));
    expect(realiser.realise(man).realisation).toBe("the man jack");
  });

  test("Complementation", () => {
    const man = f.createNounPhrase("man");
    man.specifier = "the";

    // complementation with a WordElement
    man.setComplement(f.createWord("jack", LexicalCategory.NOUN));
    expect(realiser.realise(man).realisation).toBe("the man jack");

    const woman = f.createNounPhrase("woman");
    woman.specifier = "the";
    const behindTheCurtain = f.createPrepositionPhrase("behind", "the curtain");

    woman.addComplement(behindTheCurtain);
    expect(realiser.realise(woman).realisation).toBe(
      "the woman behind the curtain",
    );
  });

  test("Possessive", () => {
    // simple possessive 's: 'a man's'
    const possNP = f.createNounPhraseDetNoun("a", "man");
    possNP.features[Feature.POSSESSIVE] = true;
    expect(realiser.realise(possNP).realisation).toBe("a man's");

    // now set this possessive as specifier of the NP 'the dog'
    const dog = f.createNounPhrase("dog");
    dog.specifier = "the";
    dog.features[InternalFeature.SPECIFIER] = possNP;
    expect(realiser.realise(dog).realisation).toBe("a man's dog");

    // convert possNP to pronoun and turn "a dog" into "his dog"
    // need to specify gender, as default is NEUTER
    possNP.features[LexicalFeature.GENDER] = Gender.MASCULINE;
    possNP.features[Feature.PRONOMINAL] = true;
    expect(realiser.realise(dog).realisation).toBe("his dog");

    // make it slightly more complicated: "his dog's rock"
    dog.features[Feature.POSSESSIVE] = true; // his dog's

    const np4 = f.createNounPhrase("rock");
    np4.specifier = "the";

    // his dog's rock (substituting "the" for the entire phrase)
    np4.features[InternalFeature.SPECIFIER] = dog;
    expect(realiser.realise(np4).realisation).toBe("his dog's rock");
  });

  test("Coordination", () => {
    const dog = f.createNounPhrase("dog");
    dog.specifier = "the";
    const woman = f.createNounPhrase("woman");
    woman.specifier = "the";

    const cnp1 = f.createCoordinatedPhrase(dog, woman);
    // simple coordination
    expect(realiser.realise(cnp1).realisation).toBe("the dog and the woman");

    // simple coordination with complementation of entire coordinate NP
    const behindTheCurtain = f.createPrepositionPhrase("behind", "the curtain");
    cnp1.addComplement(behindTheCurtain);
    expect(realiser.realise(cnp1).realisation).toBe(
      "the dog and the woman behind the curtain",
    );
  });

  test("Coordination2", () => {
    const dog = f.createNounPhrase("dog");
    dog.specifier = "the";
    const woman = f.createNounPhrase("woman");
    woman.specifier = "the";

    // simple coordination of complementised nps
    dog.clearComplements();
    woman.clearComplements();

    const cnp1 = f.createCoordinatedPhrase(dog, woman);
    cnp1.features[Feature.RAISE_SPECIFIER] = true;
    const realised = realiser.realise(cnp1);
    expect(realised.realisation).toBe("the dog and woman");

    const onTheRock = f.createPrepositionPhrase("on", "the rock");
    dog.addComplement(onTheRock);

    const behindTheCurtain = f.createPrepositionPhrase("behind", "the curtain");
    woman.addComplement(behindTheCurtain);

    const cnp2 = f.createCoordinatedPhrase(dog, woman);

    woman.features[InternalFeature.RAISED] = false;
    expect(realiser.realise(cnp2).realisation).toBe(
      "the dog on the rock and the woman behind the curtain",
    );

    // complementised coordinates + outer pp modifier
    const inTheRoom = f.createPrepositionPhrase("in", "the room");
    cnp2.addPostModifier(inTheRoom);
    expect(realiser.realise(cnp2).realisation).toBe(
      "the dog on the rock and the woman behind the curtain in the room",
    );

    // set the specifier for this cnp; should unset specifiers for all inner coordinates
    const every = f.createWord("every", LexicalCategory.DETERMINER);

    cnp2.features[InternalFeature.SPECIFIER] = every;

    expect(realiser.realise(cnp2).realisation).toBe(
      "every dog on the rock and every woman behind the curtain in the room",
    );

    // pronominalise one of the constituents
    dog.features[Feature.PRONOMINAL] = true; // ="it"
    dog.features[InternalFeature.SPECIFIER] = f.createWord(
      "the",
      LexicalCategory.DETERMINER,
    );
    // raising spec still returns true as spec has been set
    cnp2.features[Feature.RAISE_SPECIFIER] = true;

    // CNP should be realised with pronominal internal const
    expect(realiser.realise(cnp2).realisation).toBe(
      "it and every woman behind the curtain in the room",
    );
  });

  test("PossessiveCoordinate", () => {
    const dog = f.createNounPhrase("dog");
    dog.specifier = "the";
    const woman = f.createNounPhrase("woman");
    woman.specifier = "the";

    // simple coordination
    const cnp2 = f.createCoordinatedPhrase(dog, woman);
    expect(realiser.realise(cnp2).realisation).toBe("the dog and the woman");

    // set possessive -- wide-scope by default
    cnp2.features[Feature.POSSESSIVE] = true;
    expect(realiser.realise(cnp2).realisation).toBe("the dog and the woman's");

    // set possessive with pronoun
    dog.features[Feature.PRONOMINAL] = true;
    dog.features[Feature.POSSESSIVE] = true;
    cnp2.features[Feature.POSSESSIVE] = true;
    expect(realiser.realise(cnp2).realisation).toBe("its and the woman's");
  });

  test("AAn", () => {
    const _dog = f.createNounPhraseDetNoun("a", "dog");
    expect(realiser.realise(_dog).realisation).toBe("a dog");

    _dog.addPreModifier("enormous");

    expect(realiser.realise(_dog).realisation).toBe("an enormous dog");

    const elephant = f.createNounPhraseDetNoun("a", "elephant");
    expect(realiser.realise(elephant).realisation).toBe("an elephant");

    elephant.addPreModifier("big");
    expect(realiser.realise(elephant).realisation).toBe("a big elephant");

    // test treating of plural specifiers
    _dog.features[Feature.NUMBER] = NumberAgreement.PLURAL;

    expect(realiser.realise(_dog).realisation).toBe("some enormous dogs");
  });

  test("AAnCoord", () => {
    const _dog = f.createNounPhraseDetNoun("a", "dog");
    _dog.addPreModifier(f.createCoordinatedPhrase("enormous", "black"));
    const realisation = realiser.realise(_dog).realisation;
    expect(realisation).toBe("an enormous and black dog");
  });

  test("AAnWithNumbers", () => {
    const num = f.createNounPhraseDetNoun("a", "change");

    // no an with "one"
    num.setPreModifier("one percent");
    expect(realiser.realise(num).realisation).toBe("a one percent change");

    // an with "eighty"
    num.setPreModifier("eighty percent");
    expect(realiser.realise(num).realisation).toBe("an eighty percent change");

    // an with 80
    num.setPreModifier("80%");
    expect(realiser.realise(num).realisation).toBe("an 80% change");

    // an with 80000
    num.setPreModifier("80000");
    expect(realiser.realise(num).realisation).toBe("an 80000 change");

    // an with 11,000
    num.setPreModifier("11,000");
    expect(realiser.realise(num).realisation).toBe("an 11,000 change");

    // an with 18
    num.setPreModifier("18%");
    expect(realiser.realise(num).realisation).toBe("an 18% change");

    // a with 180
    num.setPreModifier("180");
    expect(realiser.realise(num).realisation).toBe("a 180 change");

    // a with 1100
    num.setPreModifier("1100");
    expect(realiser.realise(num).realisation).toBe("a 1100 change");

    // a with 180,000
    num.setPreModifier("180,000");
    expect(realiser.realise(num).realisation).toBe("a 180,000 change");

    // an with 11000
    num.setPreModifier("11000");
    expect(realiser.realise(num).realisation).toBe("an 11000 change");

    // an with 18000
    num.setPreModifier("18000");
    expect(realiser.realise(num).realisation).toBe("an 18000 change");

    // an with 18.1
    num.setPreModifier("18.1%");
    expect(realiser.realise(num).realisation).toBe("an 18.1% change");

    // an with 11.1
    num.setPreModifier("11.1%");
    expect(realiser.realise(num).realisation).toBe("an 11.1% change");
  });

  test("Modifier", () => {
    const _dog = f.createNounPhraseDetNoun("a", "dog");
    _dog.addPreModifier("angry");

    expect(realiser.realise(_dog).realisation).toBe("an angry dog");

    _dog.addPostModifier("in the park");
    expect(realiser.realise(_dog).realisation).toBe("an angry dog in the park");

    const cat = f.createNounPhraseDetNoun("a", "cat");
    cat.addPreModifier(f.createAdjectivePhrase("angry"));
    expect(realiser.realise(cat).realisation).toBe("an angry cat");

    cat.addPostModifier(f.createPrepositionPhrase("in", "the park"));
    expect(realiser.realise(cat).realisation).toBe("an angry cat in the park");
  });

  test("PluralNounsBelongingToASingular", () => {
    const sent = f.createClause("I", "count up");
    sent.features[Feature.TENSE] = Tense.PAST;
    const obj = f.createNounPhrase("digit");
    obj.plural = true;
    const possessor = f.createNounPhraseDetNoun("the", "box");
    possessor.plural = false;
    possessor.features[Feature.POSSESSIVE] = true;
    obj.specifier = possessor;
    sent.setObject(obj);

    expect(realiser.realise(sent).realisation).toBe(
      "I counted up the box's digits",
    );
  });

  test("SingularNounsBelongingToAPlural", () => {
    const sent = f.createClause("I", "clean");
    sent.features[Feature.TENSE] = Tense.PAST;
    const obj = f.createNounPhrase("car");
    obj.plural = false;
    const possessor = f.createNounPhraseDetNoun("the", "parent");
    possessor.plural = true;
    possessor.features[Feature.POSSESSIVE] = true;
    obj.specifier = possessor;
    sent.setObject(obj);

    expect(realiser.realise(sent).realisation).toBe(
      "I cleaned the parents' car",
    );
  });

  test("AppositivePostmodifier", () => {
    const _dog = f.createNounPhraseDetNoun("the", "dog");
    const _rott = f.createNounPhraseDetNoun("a", "rottweiler");
    _rott.features[Feature.APPOSITIVE] = true;
    _dog.addPostModifier(_rott);
    const _sent = f.createClause(_dog, "ran");
    expect(realiser.realiseSentence(_sent)).toBe(
      "The dog, a rottweiler, runs.",
    );
  });
});
