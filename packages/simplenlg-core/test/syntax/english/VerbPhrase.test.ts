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

// ...other imports as needed...

// Assume that getTestData() returns an object with phraseFactory, realiser, lexicon, fallDown, kick, man, behindTheCurtain, inTheRoom, etc.
import { NLGFactory } from "../../../src/factory/NLGFactory.js";
import { DiscourseFunction } from "../../../src/features/DiscourseFunction.js";
import { Feature } from "../../../src/features/Feature.js";
import { Form } from "../../../src/features/Form.js";
import { InternalFeature } from "../../../src/features/InternalFeature.js";
import { NumberAgreement } from "../../../src/features/NumberAgreement.js";
import { Person } from "../../../src/features/Person.js";
import { Tense } from "../../../src/features/Tense.js";
import { NLGElement } from "../../../src/framework/NLGElement.js";
import { WordElement } from "../../../src/framework/WordElement.js";
import { Realiser } from "../../../src/index.js";
import { NPPhraseSpec } from "../../../src/phrasespec/NPPhraseSpec.js";
import { PPPhraseSpec } from "../../../src/phrasespec/PPPhraseSpec.js";
import { VPPhraseSpec } from "../../../src/phrasespec/VPPhraseSpec.js";
import getTestData from "../../englishTestSet.js";

describe("VerbPhraseTest", () => {
  let f: NLGFactory,
    realiser: Realiser,
    fallDown: VPPhraseSpec,
    kick: VPPhraseSpec,
    man: NPPhraseSpec,
    behindTheCurtain: PPPhraseSpec,
    inTheRoom: PPPhraseSpec,
    d: ReturnType<typeof getTestData>;

  beforeEach(() => {
    d = getTestData();
    f = d.context.factory;
    realiser = d.realiser;
    fallDown = d.verbPhrase.fallDown;
    kick = d.verbPhrase.kick;
    man = d.nounPhrase.theMan;
    behindTheCurtain = d.prepositionPhrase.behindTheCurtain;
    inTheRoom = d.prepositionPhrase.inTheRoom;
  });

  test("Verb Particle", () => {
    const v = f.createVerbPhrase("fall down");
    expect(v.features[Feature.PARTICLE]).toBe("down");
    expect((v.verb as WordElement).baseForm).toBe("fall");

    v.features[Feature.TENSE] = Tense.PAST;
    v.features[Feature.PERSON] = Person.THIRD;
    v.features[Feature.NUMBER] = NumberAgreement.PLURAL;
    expect(realiser.realise(v).realisation).toBe("fell down");

    v.features[Feature.FORM] = Form.PAST_PARTICIPLE;
    expect(realiser.realise(v).realisation).toBe("fallen down");
  });

  test("Simple Past", () => {
    fallDown.features[Feature.TENSE] = Tense.PAST;
    expect(realiser.realise(fallDown).realisation).toBe("fell down");
  });

  test("Tense Aspect", () => {
    fallDown.features[Feature.TENSE] = Tense.PAST;
    fallDown.features[Feature.PERFECT] = true;
    expect(realiser.realise(fallDown).realisation).toBe("had fallen down");

    fallDown.features[Feature.PROGRESSIVE] = true;
    expect(realiser.realise(fallDown).realisation).toBe(
      "had been falling down",
    );

    kick.features[Feature.PASSIVE] = true;
    kick.features[Feature.PERFECT] = true;
    kick.features[Feature.TENSE] = Tense.FUTURE;
    expect(realiser.realise(kick).realisation).toBe("will have been kicked");

    kick.features[Feature.PROGRESSIVE] = true;
    expect(realiser.realise(kick).realisation).toBe(
      "will have been being kicked",
    );

    kick.features[Feature.NEGATED] = true;
    expect(realiser.realise(kick).realisation).toBe(
      "will not have been being kicked",
    );

    kick.clearComplements();
    kick.addComplement(man);
    expect(realiser.realise(kick).realisation).toBe(
      "will not have been being kicked",
    );

    kick.features[Feature.PASSIVE] = false;
    expect(realiser.realise(kick).realisation).toBe(
      "will not have been kicking the man",
    );

    kick.features[Feature.TENSE] = Tense.PRESENT;
    expect(realiser.realise(kick).realisation).toBe(
      "has not been kicking the man",
    );
  });

  test("Complementation", () => {
    const mary = f.createNounPhrase("Mary");
    mary.features[InternalFeature.DISCOURSE_FUNCTION] =
      DiscourseFunction.OBJECT;
    const kiss = f.createVerbPhrase("kiss");
    kiss.clearComplements();
    kiss.addComplement(mary);
    kiss.features[Feature.PROGRESSIVE] = true;
    kiss.features[Feature.TENSE] = Tense.PAST;
    expect(realiser.realise(kiss).realisation).toBe("was kissing Mary");

    const susan = f.createNounPhrase("Susan");
    const maryAndSusan = f.createCoordinatedPhrase(mary, susan);
    kiss.clearComplements();
    kiss.addComplement(maryAndSusan);
    expect(realiser.realise(kiss).realisation).toBe(
      "was kissing Mary and Susan",
    );

    kiss.features[Feature.PASSIVE] = true;
    expect(realiser.realise(kiss).realisation).toBe("was being kissed");

    kiss.features[Feature.NUMBER] = NumberAgreement.PLURAL; // TODO (debug): Plurality is not propagated
    expect(realiser.realise(kiss).realisation).toBe("were being kissed");

    kiss.addPostModifier(inTheRoom);
    kiss.features[Feature.PASSIVE] = false;
    kiss.features[Feature.NUMBER] = NumberAgreement.SINGULAR;
    expect(realiser.realise(kiss).realisation).toBe(
      "was kissing Mary and Susan in the room",
    );

    kiss.features[Feature.PASSIVE] = true;
    kiss.features[Feature.NUMBER] = NumberAgreement.PLURAL;
    expect(realiser.realise(kiss).realisation).toBe(
      "were being kissed in the room",
    );
  });

  test("Complementation 2", () => {
    const woman = d.nounPhrase.theWoman;
    woman.features[InternalFeature.DISCOURSE_FUNCTION] =
      DiscourseFunction.INDIRECT_OBJECT;
    const dog = d.nounPhrase.theDog;
    dog.features[InternalFeature.DISCOURSE_FUNCTION] = DiscourseFunction.OBJECT;
    const give = d.verbPhrase.give;
    give.clearComplements();
    give.addComplement(dog);
    give.addComplement(woman);
    expect(realiser.realise(give).realisation).toBe("gives the woman the dog");

    give.addPreModifier("slowly");
    give.addPostModifier(behindTheCurtain);
    give.addPostModifier(inTheRoom);
    expect(realiser.realise(give).realisation).toBe(
      "slowly gives the woman the dog behind the curtain in the room",
    );

    give.clearComplements();
    give.addComplement(dog);
    const boy = d.nounPhrase.theBoy;
    const womanBoy = f.createCoordinatedPhrase(woman, boy);
    womanBoy.features[InternalFeature.DISCOURSE_FUNCTION] =
      DiscourseFunction.INDIRECT_OBJECT;
    give.addComplement(womanBoy);
    give.features[Feature.PASSIVE] = false;
    expect(realiser.realise(give).realisation).toBe(
      "slowly gives the woman and the boy the dog behind the curtain in the room",
    );

    give.clearComplements();
    give.addComplement(womanBoy);
    give.addComplement(dog);
    const complements = give.features["complements"] || [];
    const indirectCount = complements.filter(
      (e: NLGElement) =>
        e.features[InternalFeature.DISCOURSE_FUNCTION] ===
        DiscourseFunction.INDIRECT_OBJECT,
    ).length;
    expect(indirectCount).toBe(1);
    expect(realiser.realise(give).realisation).toBe(
      "slowly gives the woman and the boy the dog behind the curtain in the room",
    );
  });

  test("Passive Complement", () => {
    const dog = d.nounPhrase.theDog;
    dog.features[InternalFeature.DISCOURSE_FUNCTION] = DiscourseFunction.OBJECT;
    const woman = d.nounPhrase.theWoman;
    woman.features[InternalFeature.DISCOURSE_FUNCTION] =
      DiscourseFunction.INDIRECT_OBJECT;
    const give = d.verbPhrase.give;
    give.clearComplements();
    give.addComplement(dog);
    give.addComplement(woman);
    expect(realiser.realise(give).realisation).toBe("gives the woman the dog");

    give.addPreModifier("slowly");
    give.addPostModifier(behindTheCurtain);
    give.addPostModifier(inTheRoom);
    expect(realiser.realise(give).realisation).toBe(
      "slowly gives the woman the dog behind the curtain in the room",
    );

    give.clearComplements();
    give.addComplement(dog);
    give.addComplement(woman);
    give.features[Feature.PASSIVE] = true;
    expect(realiser.realise(give).realisation).toBe(
      "is slowly given the woman behind the curtain in the room",
    );
  });

  test("Clausal Complement", () => {
    const kiss = f.createVerbPhrase("kiss");
    kiss.addComplement(f.createNounPhrase("Mary"));
    const s = f.createClause({
      subject: f.createNounPhrase("John"),
      verbPhrase: kiss,
      directObject: f.createCoordinatedPhrase(
        f.createNounPhrase("Mary"),
        f.createNounPhrase("Susan"),
      ),
    });

    s.features[Feature.PROGRESSIVE] = true;
    s.features[Feature.TENSE] = Tense.PAST;
    s.addPostModifier(inTheRoom);
    expect(realiser.realise(s).realisation).toBe(
      "John was kissing Mary and Susan in the room",
    );

    const say = f.createVerbPhrase("say");
    say.features[Feature.TENSE] = Tense.PAST;
    expect(realiser.realise(say).realisation).toBe("said");

    say.addComplement(s);
    expect(realiser.realise(say).realisation).toBe(
      "said that John was kissing Mary and Susan in the room",
    );

    say.addPostModifier(behindTheCurtain);
    expect(realiser.realise(say).realisation).toBe(
      "said that John was kissing Mary and Susan in the room behind the curtain",
    );

    const s2 = f.createClause(
      f.createNounPhrase("all"),
      "be",
      f.createAdjectivePhrase("fine"),
    );
    s2.features[Feature.TENSE] = Tense.FUTURE;
    expect(realiser.realise(s2).realisation).toBe("all will be fine");

    const s3 = f.createCoordinatedPhrase(s, s2);
    say.clearComplements();
    say.addComplement(s3);
    s3.features[Feature.SUPRESSED_COMPLEMENTISER] = true;
    expect(realiser.realise(say).realisation).toBe(
      "said that John was kissing Mary and Susan in the room and all will be fine behind the curtain",
    );
  });

  test("Clausal Complement 2", () => {
    const kiss = f.createVerbPhrase("kiss");
    kiss.addComplement(f.createNounPhrase("Mary"));
    const sNew = f.createClause({
      subject: f.createNounPhrase("John"),
      verbPhrase: kiss,
      directObject: f.createCoordinatedPhrase(
        f.createNounPhrase("Mary"),
        f.createNounPhrase("Susan"),
      ),
    });

    sNew.features[Feature.PROGRESSIVE] = true;
    sNew.features[Feature.TENSE] = Tense.PAST;
    sNew.addPostModifier(inTheRoom);
    const s2New = f.createClause(
      f.createNounPhrase("all"),
      "be",
      f.createAdjectivePhrase("fine"),
    );
    s2New.features[Feature.TENSE] = Tense.FUTURE;
    const s3New = f.createCoordinatedPhrase(sNew, s2New);
    const say = f.createVerbPhrase("say");
    say.addComplement(s3New);
    say.features[Feature.TENSE] = Tense.PAST;
    say.addPostModifier(behindTheCurtain);
    expect(realiser.realise(say).realisation).toBe(
      "said that John was kissing Mary and Susan in the room and that all will be fine behind the curtain",
    );
  });

  test("Coordination", () => {
    const kiss = d.verbPhrase.kiss;
    kiss.addComplement(d.nounPhrase.theDog);
    const kick = d.verbPhrase.kick;
    kick.addComplement(d.nounPhrase.theBoy);
    const coord1 = f.createCoordinatedPhrase(kiss, kick);
    coord1.features[Feature.PERSON] = Person.THIRD;
    coord1.features[Feature.TENSE] = Tense.PAST;
    expect(realiser.realise(coord1).realisation).toBe(
      "kissed the dog and kicked the boy",
    );
    coord1.features[Feature.NEGATED] = true;
    expect(realiser.realise(coord1).realisation).toBe(
      "did not kiss the dog and did not kick the boy",
    );
    coord1.features[Feature.MODAL] = "could";
    expect(realiser.realise(coord1).realisation).toBe(
      "could not have kissed the dog and could not have kicked the boy",
    );
    coord1.features[Feature.PERFECT] = true;
    coord1.features[Feature.PROGRESSIVE] = true;
    expect(realiser.realise(coord1).realisation).toBe(
      "could not have been kissing the dog and could not have been kicking the boy",
    );
    coord1.features[Feature.AGGREGATE_AUXILIARY] = true;
    expect(realiser.realise(coord1).realisation).toBe(
      "could not have been kissing the dog and kicking the boy",
    );
  });
});
