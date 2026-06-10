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
import { Tense } from "../../../src/features/Tense.js";
import { InterrogativeType } from "../../../src/features/InterrogativeType.js";
import getTestData from "../../englishTestSet.js";
describe("Tutorial Test", () => {
  test("Section 3", () => {
    const d = getTestData();
    const f = d.context.factory;
    const realiser = d.realiser;
    const s1 = f.createSentence("my dog is happy");
    const output = realiser.realiseSentence(s1);
    expect(output).toBe("My dog is happy.");
  });

  test("Section 5", () => {
    const d = getTestData();
    const f = d.context.factory;
    const realiser = d.realiser;
    const p = f.createClause({
      subject: "my dog",
      verb: "chase",
      directObject: "George",
    });
    const output = realiser.realiseSentence(p);
    expect(output).toBe("My dog chases George.");
  });

  test("Section 6", () => {
    const d = getTestData();
    const f = d.context.factory;
    const realiser = d.realiser;
    const p = f.createClause({
      subject: "Mary",
      verb: "chase",
      directObject: "George",
    });

    p.features[Feature.TENSE] = Tense.PAST;
    let output = realiser.realiseSentence(p);
    expect(output).toBe("Mary chased George.");

    p.features[Feature.TENSE] = Tense.FUTURE;
    output = realiser.realiseSentence(p);
    expect(output).toBe("Mary will chase George.");

    p.features[Feature.NEGATED] = true;
    output = realiser.realiseSentence(p);
    expect(output).toBe("Mary will not chase George.");

    const p2 = f.createClause({
      subject: "Mary",
      verb: "chase",
      directObject: "George",
    });
    p2.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.YES_NO;
    output = realiser.realiseSentence(p2);
    expect(output).toBe("Does Mary chase George?");

    p2.setSubject("Mary");
    p2.verb = "chase";
    p2.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHO_OBJECT;
    output = realiser.realiseSentence(p2);
    expect(output).toBe("Who does Mary chase?");

    const p3 = f.createClause({
      subject: "the dog",
      verb: "wake up",
    });

    output = realiser.realiseSentence(p3);
    expect(output).toBe("The dog wakes up.");
  });

  test("Variants", () => {
    const d = getTestData();
    const f = d.context.factory;
    const realiser = d.realiser;

    const p = f.createClause({
      subject: "my dog",
      verb: "is",
      directObject: "George",
    });

    let output = realiser.realiseSentence(p);
    expect(output).toBe("My dog is George.");

    const p1 = f.createClause({
      subject: "my dog",
      verb: "chases",
      directObject: "George",
    });

    output = realiser.realiseSentence(p1);
    expect(output).toBe("My dog chases George.");

    const p2 = f.createClause({
      subject: f.createNounPhraseDetNoun("the", "dogs"),
      verb: "is",
      directObject: "happy",
    });

    output = realiser.realiseSentence(p2);
    expect(output).toBe("The dog is happy.");

    const p3 = f.createClause({
      subject: f.createNounPhraseDetNoun("the", "children"),
      verb: "is",
      directObject: "happy",
    });

    output = realiser.realiseSentence(p3);
    expect(output).toBe("The child is happy.");

    // repeated in the java code
    // const p4 = f.createClause({
    //     subject: f.createNounPhraseDetNoun("the", "dogs"),
    //     verb: "is",
    //     directObject: "happy"
    // });

    // output = realiser.realiseSentence(p2);
    // expect(output).toBe("The dog is happy.");
  });

  // Conversion note: repeating 5 here confused both O3 and Claude 3.5 and skipped ahead after encouting the firt Section 5

  test("Section 5A", () => {
    const d = getTestData();
    const f = d.context.factory;
    const realiser = d.realiser;

    const p = f.createClause({
      subject: "Mary",
      verb: "chase",
      directObject: "the monkey",
    });
    const output = realiser.realiseSentence(p);
    expect(output).toBe("Mary chases the monkey.");
  });

  test("Section 6A", () => {
    const d = getTestData();
    const f = d.context.factory;
    const realiser = d.realiser;
    const p = f.createClause({
      subject: "Mary",
      verb: "chase",
      directObject: "the monkey",
    });

    p.features[Feature.TENSE] = Tense.PAST;
    let output = realiser.realiseSentence(p);
    expect(output).toBe("Mary chased the monkey.");

    p.features[Feature.TENSE] = Tense.FUTURE;
    output = realiser.realiseSentence(p);
    expect(output).toBe("Mary will chase the monkey.");

    p.features[Feature.NEGATED] = true;
    output = realiser.realiseSentence(p);
    expect(output).toBe("Mary will not chase the monkey.");

    const p2 = f.createClause({
      subject: "Mary",
      verb: "chase",
      directObject: "the monkey",
    });
    p2.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.YES_NO;
    output = realiser.realiseSentence(p2);
    expect(output).toBe("Does Mary chase the monkey?");

    p2.setSubject("Mary");
    p2.verb = "chase";
    p2.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHO_OBJECT;
    output = realiser.realiseSentence(p2);
    expect(output).toBe("Who does Mary chase?");
  });

  test("Section 7", () => {
    const d = getTestData();
    const f = d.context.factory;
    const realiser = d.realiser;

    const p = f.createClause({
      subject: "Mary",
      verb: "chase",
      directObject: "the monkey",
    });
    p.addComplement(f.createStringElement("very quickly"));
    p.addComplement(f.createStringElement("despite her exhaustion"));
    const output = realiser.realiseSentence(p);
    expect(output).toBe(
      "Mary chases the monkey very quickly despite her exhaustion.",
    );
  });

  test("Section 8", () => {
    const d = getTestData();
    const f = d.context.factory;
    const realiser = d.realiser;

    const subject = f.createNounPhrase("Mary");
    const object = f.createNounPhrase("the monkey");
    const verb = f.createVerbPhrase("chase");
    subject.addModifier("fast");

    const p = f.createClause({
      subject: subject,
      verb: verb,
      directObject: object,
    });

    let output = realiser.realiseSentence(p);
    expect(output).toBe("Fast Mary chases the monkey.");

    verb.addModifier("quickly");
    output = realiser.realiseSentence(p);
    expect(output).toBe("Fast Mary quickly chases the monkey.");
  });

  test("Section 10", () => {
    const d = getTestData();
    const f = d.context.factory;
    const realiser = d.realiser;

    const subject1 = f.createNounPhrase("Mary");
    const subject2 = f.createNounPhraseDetNoun("your", "giraffe");
    const subj = f.createCoordinatedPhrase(subject1, subject2);
    const verb = f.createVerbPhrase("chase");

    const p = f.createClause({
      subject: subj,
      verb: verb,
      directObject: "the monkey",
    });

    let output = realiser.realiseSentence(p);
    expect(output).toBe("Mary and your giraffe chase the monkey.");

    const object1 = f.createNounPhrase("the monkey");
    const object2 = f.createNounPhrase("George");
    const obj = f.createCoordinatedPhrase(object1, object2);
    obj.addCoordinate("Martha");
    p.setObject(obj);

    output = realiser.realiseSentence(p);
    expect(output).toBe(
      "Mary and your giraffe chase the monkey, George and Martha.",
    );

    obj.features[Feature.CONJUNCTION] = "or";
    output = realiser.realiseSentence(p);
    expect(output).toBe(
      "Mary and your giraffe chase the monkey, George or Martha.",
    );
  });

  test("Section 11", () => {
    const d = getTestData();
    const f = d.context.factory;
    const realiser = d.realiser;

    const pA = f.createClause("Mary", "chase", "the monkey");
    pA.addComplement(f.createStringElement("in the park"));
    let output = realiser.realiseSentence(pA);
    expect(output).toBe("Mary chases the monkey in the park.");

    const place = f.createNounPhrase("park");
    const pB = f.createClause("Mary", "chase", "the monkey");
    place.determiner = "the";
    const pp = f.createPrepositionPhrase("in", place);
    pB.addComplement(pp);

    output = realiser.realiseSentence(pB);
    expect(output).toBe("Mary chases the monkey in the park.");

    place.addPreModifier("leafy");
    output = realiser.realiseSentence(pB);
    expect(output).toBe("Mary chases the monkey in the leafy park.");
  });

  test("Section 13", () => {
    const d = getTestData();
    const f = d.context.factory;
    const realiser = d.realiser;

    const s1 = f.createClause("my cat", "like", "fish");
    const s2 = f.createClause("my dog", "like", "big bones");
    const s3 = f.createClause("my horse", "like", "grass");

    const c = f.createCoordinatedPhrase();
    c.addCoordinate(s1);
    c.addCoordinate(s2);
    c.addCoordinate(s3);

    let output = realiser.realiseSentence(c);
    expect(output).toBe(
      "My cat likes fish, my dog likes big bones and my horse likes grass.",
    );

    const p = f.createClause("I", "be", "happy");
    const q = f.createClause("I", "eat", "fish");
    q.features[Feature.COMPLEMENTISER] = f.createStringElement("because");
    q.features[Feature.TENSE] = Tense.PAST;
    p.addComplement(q);

    output = realiser.realiseSentence(p);
    expect(output).toBe("I am happy because I ate fish.");
  });

  test("Section 14", () => {
    const d = getTestData();
    const f = d.context.factory;
    const realiser = d.realiser;

    const p1 = f.createClause("Mary", "chase", "the monkey");
    const p2 = f.createClause("The monkey", "fight back");
    const p3 = f.createClause("Mary", "be", "nervous");

    const s1 = f.createSentence(p1);
    const s2 = f.createSentence(p2);
    const s3 = f.createSentence(p3);

    const par1 = f.createParagraph([s1, s2, s3]);

    let output = realiser.realise(par1).realisation;
    expect(output).toBe(
      "Mary chases the monkey. The monkey fights back. Mary is nervous.\n\n",
    );

    const section = f.createSection(
      "The Trials and Tribulation of Mary and the Monkey",
    );
    section.addComponent(par1);
    output = realiser.realise(section).realisation;
    expect(output).toBe(
      "The Trials and Tribulation of Mary and the Monkey\n" +
        "Mary chases the monkey. The monkey fights back. Mary is nervous.\n\n",
    );
  });
});
