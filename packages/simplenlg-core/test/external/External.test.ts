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

import { NLGFactory } from "../../src/factory/NLGFactory.js";
import { Realiser } from "../../src/index.js";
import { Feature } from "../../src/features/Feature.js";
import { Tense } from "../../src/features/Tense.js";
import { ClauseCoordinationRule } from "../../src/aggregation/ClauseCoordinationRule.js";
import getTestData from "../englishTestSet.js";
import { Form } from "../../src/features/Form.js";
import { InterrogativeType } from "../../src/features/InterrogativeType.js";
import { NumberAgreement } from "../../src/features/NumberAgreement.js";
import { LexicalFeature } from "../../src/features/LexicalFeature.js";
import { Gender } from "../../src/features/Gender.js";
import { Person } from "../../src/features/Person.js";
import { LexicalCategory } from "../../src/framework/LexicalCategory.js";
import { InflectedWordElement } from "../../src/framework/InflectedWordElement.js";
import { PhraseCategory } from "../../src/framework/PhraseCategory.js";

describe("External Tests", () => {
  let d: ReturnType<typeof getTestData>, f: NLGFactory, realiser: Realiser;

  beforeEach(() => {
    d = getTestData();
    f = d.context.factory;
    realiser = d.realiser;
  });

  test("Forcher", () => {
    const s1 = f.createClause({
      directObject: "Marie",
      verb: "associate",
    });
    s1.features[Feature.PASSIVE] = true;
    const pp1 = f.createPrepositionPhrase("with");
    pp1.addComplement("Peter");
    pp1.addComplement("Paul");
    s1.addPostModifier(pp1);

    expect(realiser.realise(s1).realisation).toBe(
      "Marie is associated with Peter and Paul",
    );

    const s2 = f.createClause({
      subject: "Peter",
      verb: "have",
      directObject: "something to do",
    });
    s2.addPostModifier(f.createPrepositionPhrase("with", "Paul"));

    expect(realiser.realise(s2).realisation).toBe(
      "Peter has something to do with Paul",
    );
  });

  test("Lu", () => {
    const s1 = f.createClause("we", "consider", "John");
    s1.addPostModifier("a friend");
    expect(realiser.realise(s1).realisation).toBe("we consider John a friend");
  });

  test("Dwight", () => {
    const noun4 = f.createNounPhrase("FGFR3 gene in every cell");
    noun4.specifier = "the";
    const prep1 = f.createPrepositionPhrase("of", noun4);
    const noun1 = f.createNounPhraseDetNoun("the", "patient's mother");
    const noun2 = f.createNounPhraseDetNoun("the", "patient's father");

    const noun3 = f.createNounPhrase("changed copy");
    noun3.addPreModifier("one");
    noun3.addComplement(prep1);

    const coordNoun1 = f.createCoordinatedPhrase(noun1, noun2);
    coordNoun1.features[Feature.CONJUNCTION] = "or";

    const verbPhrase1 = f.createVerbPhrase("have");
    verbPhrase1.features[Feature.TENSE] = Tense.PRESENT;

    const sentence1 = f.createClause(coordNoun1, verbPhrase1, noun3);

    expect(realiser.realise(sentence1).realisation).toBe(
      "the patient's mother or the patient's father has one changed copy of the FGFR3 gene in every cell",
    );

    // Rachel's second test
    const noun3b = f.createNounPhraseDetNoun("a", "gene test");
    const noun2b = f.createNounPhraseDetNoun("an", "LDL test");
    const noun1b = f.createNounPhraseDetNoun("the", "clinic");
    const verbPhrase1b = f.createVerbPhrase("perform");

    const coord1 = f.createCoordinatedPhrase(noun2b, noun3b);
    const sentence1b = f.createClause(noun1b, verbPhrase1b, coord1);
    sentence1b.features[Feature.TENSE] = Tense.PAST;

    expect(realiser.realise(sentence1b).realisation).toBe(
      "the clinic performed an LDL test and a gene test",
    );
  });

  // Helper functions for rafaelTest
  const createPhrase = (name: string, verb: string) => {
    const s = f.createClause({
      subject: f.createNounPhrase(name),
      verb: verb,
      directObject: "it",
    });
    s.features[Feature.TENSE] = Tense.PAST;
    return s;
  };

  const commentPhrase = (name: string) => createPhrase(name, "comment on");
  const agreePhrase = (name: string) => createPhrase(name, "agree with");
  const disagreePhrase = (name: string) => createPhrase(name, "disagree with");

  test("rafaelTest", () => {
    const ss = [
      agreePhrase("John Lennon"),
      disagreePhrase("Geri Halliwell"),
      commentPhrase("Melanie B"),
      agreePhrase("you"),
      commentPhrase("Emma Bunton"),
    ];

    const coord = ClauseCoordinationRule.create(d.context);
    const results = coord.applyAllAggregation(ss);

    const realizations = results.map((r) => realiser.realise(r).realisation);
    expect(realizations).toEqual([
      "John Lennon and you agreed with it",
      "Geri Halliwell disagreed with it",
      "Melanie B and Emma Bunton commented on it",
    ]);
  });

  test("novelliTest", () => {
    const p = f.createClause("Mary", "chase", "George");
    const pp = f.createPrepositionPhrase("in", "the park");
    p.addPostModifier(pp);
    expect(realiser.realise(p).realisation).toBe(
      "Mary chases George in the park",
    );

    const run = f.createClause("you", "go", "running");
    run.features[Feature.MODAL] = "should";
    run.addPreModifier(f.createStringElement("really"));
    const think = f.createClause("I", "think", run);
    run.features[Feature.SUPRESSED_COMPLEMENTISER] = true;

    expect(realiser.realise(think).realisation).toBe(
      "I think you should really go running",
    );
  });

  test("piotrekTest", () => {
    const sent = f.createClause("I", "shoot", "the duck");
    sent.features[Feature.TENSE] = Tense.PAST;

    const loc = f.createPrepositionPhrase("at", "the Shooting Range");
    sent.addPostModifier(loc);
    sent.features[Feature.CUE_PHRASE] = f.createStringElement("then");

    expect(realiser.realise(sent).realisation).toBe(
      "then I shot the duck at the Shooting Range",
    );
  });

  test("prescottTest", () => {
    const embedded = f.createClause("Jill", "prod", "Spot");
    const sent = f.createClause("Jack", "see", embedded);
    embedded.features[Feature.SUPRESSED_COMPLEMENTISER] = true;
    embedded.features[Feature.FORM] = Form.BARE_INFINITIVE;

    expect(realiser.realise(sent).realisation).toBe("Jack sees Jill prod Spot");
  });

  test("wissnerTest", () => {
    const p = f.createClause("a wolf", "eat");
    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHAT_OBJECT;
    expect(realiser.realise(p).realisation).toBe("what does a wolf eat");
  });

  test("phanTest", () => {
    const subjectElement = f.createNounPhrase("I");
    const verbElement = f.createVerbPhrase("run");

    const prepPhrase = f.createPrepositionPhrase("from");
    prepPhrase.addComplement("home");

    verbElement.addComplement(prepPhrase);
    const newSentence = f.createClause({
      subject: subjectElement,
      verbPhrase: verbElement,
    });

    expect(realiser.realise(newSentence).realisation).toBe("I run from home");
  });

  test("kerberTest", () => {
    const sp = f.createClause("he", "need", "stone");
    const secondSp = f.createClause({
      verb: "build",
      directObject: "a house",
    });
    secondSp.features[Feature.FORM] = Form.INFINITIVE;

    sp.addComplement(secondSp);
    expect(realiser.realise(sp).realisation).toBe(
      "he needs stone to build a house",
    );

    const sp2 = f.createClause("he", "give", "the book");
    sp2.setIndirectObject("I");
    expect(realiser.realise(sp2).realisation).toBe("he gives me the book");
  });

  test("stephensonTest", () => {
    let qs2 = f.createClause({
      subject: "moles of Gold",
      verb: "are",
      directObject: "in a 2.50 g sample of pure Gold",
    });
    qs2 = f.createClause({
      subject: "moles of Gold",
      verb: "are",
      directObject: "in a 2.50 g sample of pure Gold",
    });
    qs2.features[Feature.NUMBER] = NumberAgreement.PLURAL;
    qs2.features[Feature.PASSIVE] = false;
    qs2.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.HOW_MANY;
    const sentence = f.createSentence(qs2);
    expect(realiser.realise(sentence).realisation).toBe(
      "How many moles of Gold are in a 2.50 g sample of pure Gold?",
    );
  });

  test("pierreTest", () => {
    let p = f.createClause("Mary", "chase", "George");
    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHAT_OBJECT;
    expect(realiser.realiseSentence(p)).toBe("What does Mary chase?");

    p = f.createClause("Mary", "chase", "George");
    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.YES_NO;
    expect(realiser.realiseSentence(p)).toBe("Does Mary chase George?");

    p = f.createClause("Mary", "chase", "George");
    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHERE;
    expect(realiser.realiseSentence(p)).toBe("Where does Mary chase George?");

    p = f.createClause("Mary", "chase", "George");
    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHY;
    expect(realiser.realiseSentence(p)).toBe("Why does Mary chase George?");

    p = f.createClause("Mary", "chase", "George");
    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.HOW;
    expect(realiser.realiseSentence(p)).toBe("How does Mary chase George?");
  });

  test("data2TextTest", () => {
    const p = f.createClause("the dog", "weigh", "12");
    expect(realiser.realiseSentence(p)).toBe("The dog weighs 12.");

    const dataDropout2 = f.createNLGElement(
      "data dropouts",
      PhraseCategory.NOUN_PHRASE,
    );
    dataDropout2.plural = true;
    const sentence2 = f.createClause({
      subject: f.createStringElement("there"),
      verb: "be",
      directObject: dataDropout2,
    });
    expect(realiser.realiseSentence(sentence2)).toBe(
      "There are data dropouts.",
    );

    const weather1 = f.createClause("SE 10-15", "veer", "S 15-20");
    weather1.features[Feature.FORM] = Form.GERUND;
    expect(realiser.realiseSentence(weather1)).toBe(
      "SE 10-15 veering S 15-20.",
    );

    const weather2 = f.createClause("cloudy and misty", "be", "XXX");
    const vp = weather2.verbPhrase;
    if (vp) {
      vp.features[Feature.ELIDED] = true;
    }
    expect(realiser.realiseSentence(weather2)).toBe("Cloudy and misty.");

    const weather3 = f.createClause("S 15-20", "increase", "20-25");
    weather3.features[Feature.FORM] = Form.GERUND;
    const subject = weather3.getSubject();
    if (subject) {
      subject.features[Feature.ELIDED] = true;
    }
    expect(realiser.realiseSentence(weather3)).toBe("Increasing 20-25.");

    const weather4 = f.createClause("S 20-25", "back", "SSE");
    weather4.features[Feature.FORM] = Form.GERUND;
    const weather4Subject = weather4.getSubject();
    if (weather4Subject) {
      weather4Subject.features[Feature.ELIDED] = true;
    }

    const coord = f.createCoordinatedPhrase();
    coord.addCoordinate(weather1);
    coord.addCoordinate(weather3);
    coord.addCoordinate(weather4);
    coord.conjunction = "then";
    expect(realiser.realiseSentence(coord)).toBe(
      "SE 10-15 veering S 15-20, increasing 20-25 then backing SSE.",
    );

    const weather5 = f.createClause({
      subject: "rain",
      directObject: "likely",
    });
    expect(realiser.realiseSentence(weather5)).toBe("Rain likely.");
  });

  test("wikipediaTest", () => {
    const subject = f.createNounPhraseDetNoun("the", "woman");
    subject.plural = true;
    const sentence = f.createClause(subject, "smoke");
    sentence.features[Feature.NEGATED] = true;
    expect(realiser.realiseSentence(sentence)).toBe("The women do not smoke.");

    const s1 = f.createClause("the man", "be", "hungry");
    const s2 = f.createClause("the man", "buy", "an apple");
    const result = ClauseCoordinationRule.create(d.context).applyAggregation(
      s1,
      s2,
    );
    expect(result && realiser.realiseSentence(result)).toBe(
      "The man is hungry and buys an apple.",
    );
  });

  test("leanTest", () => {
    let sentence = f.createClause({
      verb: "be",
      directObject: "a ball",
    });
    sentence.features[Feature.INTERROGATIVE_TYPE] =
      InterrogativeType.WHAT_SUBJECT;
    expect(realiser.realiseSentence(sentence)).toBe("What is a ball?");

    sentence = f.createClause({
      verb: "be",
    });
    const object = f.createNounPhrase("example");
    object.plural = true;
    object.addModifier("of jobs");
    sentence.features[Feature.INTERROGATIVE_TYPE] =
      InterrogativeType.WHAT_SUBJECT;
    sentence.setObject(object);
    expect(realiser.realiseSentence(sentence)).toBe(
      "What are examples of jobs?",
    );

    const sub1 = f.createNounPhrase("Mary");
    sub1.features[LexicalFeature.GENDER] = Gender.FEMININE;
    sub1.features[Feature.PRONOMINAL] = true;
    sub1.features[Feature.PERSON] = Person.FIRST;

    const p = f.createClause({
      verb: "chase",
      directObject: "the monkey",
      subject: sub1,
    });

    expect(realiser.realiseSentence(p)).toBe("I chase the monkey.");

    let subject = f.createNounPhrase("Mary");
    subject.features[Feature.PRONOMINAL] = true;
    subject.features[Feature.PERSON] = Person.SECOND;

    let test = f.createClause({
      subject: subject,
      verb: "cry",
    });

    test.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHY;
    test.features[Feature.TENSE] = Tense.PRESENT;
    expect(realiser.realiseSentence(test)).toBe("Why do you cry?");

    subject = f.createNounPhrase("Mary");
    subject.features[Feature.PRONOMINAL] = true;
    subject.features[Feature.PERSON] = Person.SECOND;
    test = f.createClause({
      subject: subject,
      verb: "be",
      directObject: "crying",
    });

    test.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHY;
    test.features[Feature.TENSE] = Tense.PRESENT;
    expect(realiser.realiseSentence(test)).toBe("Why are you crying?");
  });

  test("kalijurandTest", () => {
    const lemma = "walk";

    const word = d.context.lexicon.lookupWord(lemma, LexicalCategory.VERB);
    const inflectedWord = InflectedWordElement.fromWordElement(word, d.context);

    inflectedWord.features[Feature.FORM] = Form.PAST_PARTICIPLE;
    const form = realiser.realise(inflectedWord).realisation;
    expect(form).toBe("walked");

    const inflectedWord2 = InflectedWordElement.fromWordElement(
      word,
      d.context,
    );

    inflectedWord2.features[Feature.PERSON] = Person.THIRD;
    const form2 = realiser.realise(inflectedWord2).realisation;
    expect(form2).toBe("walks");
  });

  test("layTest", () => {
    const lemma = "slap";

    const word = d.context.lexicon.lookupWord(lemma, LexicalCategory.VERB);
    const inflectedWord = InflectedWordElement.fromWordElement(word, d.context);
    inflectedWord.features[Feature.FORM] = Form.PRESENT_PARTICIPLE;
    const form = realiser.realise(inflectedWord).realisation;
    expect(form).toBe("slapping");

    const v = f.createVerbPhrase("slap");
    v.features[Feature.PROGRESSIVE] = true;
    const progressive = realiser.realise(v).realisation;
    expect(progressive).toBe("is slapping");
  });
});
