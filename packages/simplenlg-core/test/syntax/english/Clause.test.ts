import set from "../../englishTestSet.js";
import { SPhraseSpec } from "../../../src/phrasespec/SPhraseSpec.js";
import { Feature } from "../../../src/features/Feature.js";
import { LexicalCategory } from "../../../src/framework/LexicalCategory.js";
import { Tense } from "../../../src/features/Tense.js";
import { PhraseCategory } from "../../../src/framework/PhraseCategory.js";
import { InternalFeature } from "../../../src/features/InternalFeature.js";
import { ClauseStatus } from "../../../src/features/ClauseStatus.js";
import { Form } from "../../../src/features/Form.js";
import { NumberAgreement } from "../../../src/features/NumberAgreement.js";
import { CoordinatedPhraseElement } from "../../../src/framework/CoordinatedPhraseElement.js";
import { DiscourseFunction } from "../../../src/features/DiscourseFunction.js";

describe("Clause", () => {
  let theWomanKissesTheMan: SPhraseSpec,
    thereIsTheDogOnTheRock: SPhraseSpec,
    theManGivesTheWomanJohnsFlower: SPhraseSpec,
    howeverTomorrowJaneAndAndrewWillPickUpTheBallsInTheShop: SPhraseSpec,
    s: ReturnType<typeof set>,
    context: ReturnType<typeof set>["context"],
    realiser: ReturnType<typeof set>["realiser"];

  beforeEach(() => {
    s = set();

    context = s.context;
    realiser = s.realiser;
    const f = context.factory;

    theWomanKissesTheMan = f.createClause(
      s.nounPhrase.theWoman,
      s.verbPhrase.kiss,
      s.nounPhrase.theMan,
    );

    s = set(s.context, s.realiser);
    thereIsTheDogOnTheRock = f.createClause("there", "be", s.nounPhrase.theDog);
    thereIsTheDogOnTheRock.addPostModifier(s.prepositionPhrase.onTheRock);
    s = set(s.context, s.realiser);
    const johnsFlower = f.createNounPhrase("flower");
    const john = f.createNounPhrase("John");
    john.features[Feature.POSSESSIVE] = true;
    johnsFlower.specifier = john;
    theManGivesTheWomanJohnsFlower = f.createClause(
      s.nounPhrase.theMan,
      s.verbPhrase.give,
      johnsFlower,
    );
    theManGivesTheWomanJohnsFlower.setIndirectObject(s.nounPhrase.theWoman);

    s = set(s.context, s.realiser);
    howeverTomorrowJaneAndAndrewWillPickUpTheBallsInTheShop = f.createClause(
      f.createCoordinatedPhrase(
        f.createNounPhrase("Jane"),
        f.createNounPhrase("Andrew"),
      ),
      f.createVerbPhrase("pick up"),
      "the balls",
    );
    howeverTomorrowJaneAndAndrewWillPickUpTheBallsInTheShop.addFrontModifier(
      "tomorrow",
    );
    howeverTomorrowJaneAndAndrewWillPickUpTheBallsInTheShop.features[
      Feature.CUE_PHRASE
    ] = f.createNLGElement("however", LexicalCategory.ADVERB);
    howeverTomorrowJaneAndAndrewWillPickUpTheBallsInTheShop.addPostModifier(
      "in the shop",
    );
    howeverTomorrowJaneAndAndrewWillPickUpTheBallsInTheShop.features[
      Feature.TENSE
    ] = Tense.FUTURE;
  });

  test("Basic Clause", () => {
    expect(realiser.realise(theWomanKissesTheMan).realisation).toBe(
      "the woman kisses the man",
    );
    expect(realiser.realise(thereIsTheDogOnTheRock).realisation).toBe(
      "there is the dog on the rock",
    );

    expect(realiser.realise(theManGivesTheWomanJohnsFlower).realisation).toBe(
      "the man gives the woman John's flower",
    );
    expect(
      realiser.realise(howeverTomorrowJaneAndAndrewWillPickUpTheBallsInTheShop)
        .realisation,
    ).toBe(
      "however tomorrow Jane and Andrew will pick up the balls in the shop",
    );
  });

  test("Did not", () => {
    const s = context.factory.createClause("John", "eat");
    s.features[Feature.NEGATED] = true;
    s.features[Feature.TENSE] = Tense.PAST;
    expect(realiser.realise(s).realisation).toBe("John did not eat");
  });

  test("Verb Phrase negation", () => {
    const vp = context.factory.createVerbPhrase("lie");
    vp.features[Feature.TENSE] = Tense.PAST;
    vp.features[Feature.NEGATED] = true;
    const compl = context.factory.createVerbPhrase("etherize");
    compl.features[Feature.TENSE] = Tense.PAST;
    vp.setComplement(compl);

    const s = context.factory.createClause(
      context.factory.createNounPhraseDetNoun("the", "patient"),
      vp,
    );
    expect(realiser.realise(s).realisation).toBe(
      "the patient did not lie etherized",
    );
  });

  test("Pronoun Arguments", () => {
    const subj = theWomanKissesTheMan.features[InternalFeature.SUBJECTS]?.[0];
    expect(subj?.isA(PhraseCategory.NOUN_PHRASE)).toBe(true);
  });

  test("Tenses", () => {
    theManGivesTheWomanJohnsFlower.features[Feature.TENSE] = Tense.PAST;
    expect(realiser.realise(theManGivesTheWomanJohnsFlower).realisation).toBe(
      "the man gave the woman John's flower",
    );

    theManGivesTheWomanJohnsFlower.features[Feature.PERFECT] = true;
    expect(realiser.realise(theManGivesTheWomanJohnsFlower).realisation).toBe(
      "the man had given the woman John's flower",
    );

    theManGivesTheWomanJohnsFlower.features[Feature.NEGATED] = true;
    expect(realiser.realise(theManGivesTheWomanJohnsFlower).realisation).toBe(
      "the man had not given the woman John's flower",
    );

    theManGivesTheWomanJohnsFlower.features[Feature.PROGRESSIVE] = true;
    expect(realiser.realise(theManGivesTheWomanJohnsFlower).realisation).toBe(
      "the man had not been giving the woman John's flower",
    );

    // Conversion note: This is commented out in the original Java test, but works as expected
    theManGivesTheWomanJohnsFlower.features[Feature.PASSIVE] = true;
    expect(realiser.realise(theManGivesTheWomanJohnsFlower).realisation).toBe(
      "John's flower had not been being given the woman by the man",
    );
  });

  test("Subordination", () => {
    s.verbPhrase.say.addComplement(theManGivesTheWomanJohnsFlower);
    expect(
      theManGivesTheWomanJohnsFlower.features[InternalFeature.CLAUSE_STATUS],
    ).toBe(ClauseStatus.SUBORDINATE);
    expect(realiser.realise(s.verbPhrase.say).realisation).toBe(
      "says that the man gives the woman John's flower",
    );
  });

  test("Form", () => {
    expect(
      theWomanKissesTheMan.features[InternalFeature.VERB_PHRASE]?.features[
        Feature.FORM
      ],
    ).toBe(Form.NORMAL);
    theWomanKissesTheMan.features[Feature.FORM] = Form.INFINITIVE;
    expect(realiser.realise(theWomanKissesTheMan).realisation).toBe(
      "to kiss the man",
    );

    thereIsTheDogOnTheRock.features[Feature.FORM] = Form.GERUND;
    expect(realiser.realise(thereIsTheDogOnTheRock).realisation).toBe(
      "there being the dog on the rock",
    );

    theManGivesTheWomanJohnsFlower.features[Feature.FORM] = Form.GERUND;
    expect(realiser.realise(theManGivesTheWomanJohnsFlower).realisation).toBe(
      "the man's giving the woman John's flower",
    );

    theManGivesTheWomanJohnsFlower.features[Feature.FORM] = Form.IMPERATIVE;
    expect(realiser.realise(theManGivesTheWomanJohnsFlower).realisation).toBe(
      "give the woman John's flower",
    );

    s.verbPhrase.say.addComplement(theManGivesTheWomanJohnsFlower);
    expect(realiser.realise(s.verbPhrase.say).realisation).toBe(
      "says to give the woman John's flower",
    );

    howeverTomorrowJaneAndAndrewWillPickUpTheBallsInTheShop.features[
      Feature.FORM
    ] = Form.IMPERATIVE;
    expect(
      realiser.realise(howeverTomorrowJaneAndAndrewWillPickUpTheBallsInTheShop)
        .realisation,
    ).toBe("however tomorrow pick up the balls in the shop");
    const f = context.factory;
    const pickup = f.createVerbPhrase("pick up");
    const janeAndAndrew = f.createCoordinatedPhrase(
      f.createNounPhrase("Jane"),
      f.createNounPhrase("Andrew"),
    );
    howeverTomorrowJaneAndAndrewWillPickUpTheBallsInTheShop = f.createClause(
      janeAndAndrew,
      pickup,
      "the balls",
    );
    howeverTomorrowJaneAndAndrewWillPickUpTheBallsInTheShop.features[
      Feature.CUE_PHRASE
    ] = f.createNLGElement("however", LexicalCategory.ADVERB);
    howeverTomorrowJaneAndAndrewWillPickUpTheBallsInTheShop.addFrontModifier(
      "tomorrow",
    );
    howeverTomorrowJaneAndAndrewWillPickUpTheBallsInTheShop.addPostModifier(
      "in the shop",
    );
    howeverTomorrowJaneAndAndrewWillPickUpTheBallsInTheShop.features[
      Feature.TENSE
    ] = Tense.FUTURE;
  });

  test("Form 2", () => {
    const f = context.factory;
    const temp1 = f.createClause(
      howeverTomorrowJaneAndAndrewWillPickUpTheBallsInTheShop,
      "be",
      "recommended",
    );
    expect(realiser.realise(temp1).realisation).toBe(
      "however tomorrow Jane and Andrew's picking up the balls in the shop is recommended",
    );

    const temp2 = f.createClause("I", "tell", temp1);
    temp2.features[Feature.TENSE] = Tense.FUTURE;
    const indirectObject = f.createNounPhrase("John");
    temp2.setIndirectObject(indirectObject);
    expect(realiser.realise(temp2).realisation).toBe(
      "I will tell John that however tomorrow Jane and Andrew's picking up the balls in the shop is recommended",
    );

    const subject = CoordinatedPhraseElement.withCoordinates(
      PhraseCategory.NOUN_PHRASE,
      f.createNounPhrase("Jane"),
      f.createNounPhrase("Andrew"),
      context,
    );
    const pickUp = f.createVerbPhrase("pick up");
    const s4Alt = f.createClause(subject, pickUp, "the balls");

    s4Alt.addFrontModifier("tomorrow");
    s4Alt.addPostModifier("in the shop");
    s4Alt.features[Feature.CUE_PHRASE] = f.createStringElement("however");
    s4Alt.features[Feature.TENSE] = Tense.FUTURE;
    s4Alt.features[Feature.FORM] = Form.IMPERATIVE;

    const temp3 = f.createClause("I", "tell", s4Alt);
    temp3.setIndirectObject(f.createNounPhrase("John"));
    temp3.features[Feature.TENSE] = Tense.FUTURE;
    expect(realiser.realise(temp3).realisation).toBe(
      "I will tell John however to pick up the balls in the shop tomorrow",
    );
  });

  test("Gerund Subject", () => {
    // the women kissing the dog upset Peter
    const f = context.factory;
    theWomanKissesTheMan.features[Feature.PERFECT] = true;
    const s4Alt = f.createClause(
      theWomanKissesTheMan,
      f.createVerbPhrase("upset"),
      f.createNounPhrase("Peter"),
    );
    s4Alt.features[Feature.TENSE] = Tense.PAST;

    // set the sentence as subject of another: makes it a gerund
    s4Alt.setSubject(theWomanKissesTheMan);

    // suppress the genitive realisation of the NP subject in gerund sentences
    theWomanKissesTheMan.features[Feature.SUPPRESS_GENITIVE_IN_GERUND] = true;

    expect(realiser.realise(s4Alt).realisation).toBe(
      "the woman having kissed the man upset Peter",
    );
  });

  test("Complex Sentence 1A", () => {
    const f = context.factory;
    // the man's giving the woman John's flower upset Peter
    const complexS = f.createClause(
      theManGivesTheWomanJohnsFlower,
      f.createVerbPhrase("upset"),
      f.createNounPhrase("Peter"),
    );
    complexS.features[Feature.TENSE] = Tense.PAST;
    theManGivesTheWomanJohnsFlower.features[Feature.PERFECT] = true;
    // check the realisation: subject should be genitive
    expect(realiser.realise(complexS).realisation).toBe(
      "the man's having given the woman John's flower upset Peter",
    );
  });

  test("Complex Sentence 1B", () => {
    const f = context.factory;
    // Conversion note: Java test resets withing the function, we split it up into three tests
    const s5 = f.createClause(
      f.createNounPhraseDetNoun("some", "person"),
      f.createVerbPhrase("stroke"),
      f.createNounPhraseDetNoun("the", "cat"),
    );
    const coord = f.createCoordinatedPhrase(theManGivesTheWomanJohnsFlower, s5);
    const complexS = f.createClause(
      coord,
      f.createVerbPhrase("upset"),
      f.createNounPhrase("Peter"),
    );
    complexS.features[Feature.TENSE] = Tense.PAST;
    theManGivesTheWomanJohnsFlower.features[Feature.PERFECT] = true;

    expect(realiser.realise(complexS).realisation).toBe(
      "the man's having given the woman John's flower and some person's stroking the cat upset Peter",
    );
  });

  test("Complex Sentence 1C", () => {
    const f = context.factory;
    // Conversion note: Java test resets withing the function, we split it up into three tests. We need to create coord again.
    const s5 = f.createClause(
      f.createNounPhraseDetNoun("some", "person"),
      f.createVerbPhrase("stroke"),
      f.createNounPhraseDetNoun("the", "cat"),
    );
    const s6 = f.createClause(
      f.createNounPhraseDetNoun("the", "boy"),
      f.createVerbPhrase("tell"),
    );
    s6.features[Feature.TENSE] = Tense.PAST;
    s6.setIndirectObject(f.createNounPhraseDetNoun("every", "girl"));

    const coord = f.createCoordinatedPhrase(theManGivesTheWomanJohnsFlower, s5);
    const complexS = f.createClause(
      coord,
      f.createVerbPhrase("upset"),
      f.createNounPhrase("Peter"),
    );
    complexS.features[Feature.TENSE] = Tense.PAST;
    s6.setObject(complexS);
    theManGivesTheWomanJohnsFlower.features[Feature.PERFECT] = true;
    expect(realiser.realise(s6).realisation).toBe(
      "the boy told every girl that the man's having given the woman John's flower and some person's stroking the cat upset Peter",
    );
  });

  test("Complex Sentence 2", () => {
    // Commented out in the original Java test
    const f = context.factory;
    const subject = f.createClause(
      f.createNounPhraseDetNoun("the", "child"),
      f.createVerbPhrase("be"),
      f.createWord("difficult", LexicalCategory.ADJECTIVE),
    );
    subject.features[Feature.PROGRESSIVE] = true;
    expect(realiser.realise(subject).realisation).toBe(
      "the child is being difficult",
    );
  });

  test("Complex Sentence 3", () => {
    const f = context.factory;
    const manAlt = context.factory.createNounPhraseDetNoun("the", "man");
    const womanAlt = context.factory.createNounPhraseDetNoun("the", "woman");

    // Create simple sentences
    const s1Alt = f.createClause(
      s.nounPhrase.theWoman,
      "kiss" /* we need a verb, not a vp, so using string */,
      s.nounPhrase.theMan,
    );

    const flower = f.createNounPhrase("flower");
    const john = f.createNounPhrase("John");
    john.features[Feature.POSSESSIVE] = true;
    flower.specifier = john;
    const s3Alt = f.createClause(manAlt, "give", flower);
    s3Alt.setIndirectObject(womanAlt);

    const coord = context.factory.createCoordinatedPhrase(s1Alt, s3Alt);
    coord.features[Feature.TENSE] = Tense.PAST;

    expect(realiser.realise(coord).realisation).toBe(
      "the woman kissed the man and the man gave the woman John's flower",
    );
  });

  test("String Recognition", () => {
    const f = context.factory;
    // test recognition of forms of "be"
    const s1Alt = f.createClause("my cat", "be", "sad");
    expect(realiser.realise(s1Alt).realisation).toBe("my cat is sad");

    // test recognition of pronoun for agreement
    const s2Alt = f.createClause("I", "want", "Mary");
    expect(realiser.realise(s2Alt).realisation).toBe("I want Mary");

    // test recognition of pronoun for correct form
    const subject = f.createNounPhrase("dog");
    subject.features[InternalFeature.SPECIFIER] = f.createStringElement("a");
    subject.addPostModifier("from next door");
    const object = f.createNounPhrase("I");
    const s = f.createClause(subject, "chase", object);
    s.features[Feature.PROGRESSIVE] = true;
    expect(realiser.realise(s).realisation).toBe(
      "a dog from next door is chasing me",
    );
  });

  test("Agreement", () => {
    // basic agreement
    const np1 = context.factory.createNounPhrase("dog");
    np1.specifier = "the";
    np1.addPreModifier("angry");
    const s1Alt = context.factory.createClause(np1, "chase", "John");
    expect(realiser.realise(s1Alt).realisation).toBe(
      "the angry dog chases John",
    );

    const np2 = context.factory.createNounPhrase("dog");
    np2.specifier = "the";
    np2.addPreModifier("angry");
    np2.features[Feature.NUMBER] = NumberAgreement.PLURAL;
    const s2Alt = context.factory.createClause(np2, "chase", "John");
    expect(realiser.realise(s2Alt).realisation).toBe(
      "the angry dogs chase John",
    );

    // test agreement with "there is"
    const np3 = context.factory.createNounPhrase("dog");
    np3.addPreModifier("angry");
    np3.features[Feature.NUMBER] = NumberAgreement.SINGULAR;
    np3.specifier = "a";
    const s3Alt = context.factory.createClause("there", "be", np3);
    expect(realiser.realise(s3Alt).realisation).toBe("there is an angry dog");

    // plural with "there"
    const np4 = context.factory.createNounPhrase("dog");
    np4.addPreModifier("angry");
    np4.specifier = "a";
    np4.features[Feature.NUMBER] = NumberAgreement.PLURAL;
    const s4Alt = context.factory.createClause("there", "be", np4);
    expect(realiser.realise(s4Alt).realisation).toBe(
      "there are some angry dogs",
    );
  });

  test("Passive", () => {
    // passive with just complement
    const f = context.factory;
    let s1Alt = f.createClause({
      verb: "intubate",
      directObject: f.createNounPhraseDetNoun("the", "baby"),
    });
    s1Alt.features[Feature.PASSIVE] = true;
    expect(realiser.realise(s1Alt).realisation).toBe("the baby is intubated");

    // passive with subject and complement
    s1Alt = f.createClause({
      verb: "intubate",
      directObject: f.createNounPhraseDetNoun("the", "baby"),
    });
    s1Alt.setSubject(f.createNounPhrase("the nurse"));
    s1Alt.features[Feature.PASSIVE] = true;
    expect(realiser.realise(s1Alt).realisation).toBe(
      "the baby is intubated by the nurse",
    );

    const s2Alt1 = f.createClause({
      directObject: f.createNounPhraseDetNoun("the", "baby"),
      verb: "give",
      indirectObject: f.createNounPhrase("50ug of morphine"),
    });
    s2Alt1.features[Feature.PASSIVE] = true;
    expect(realiser.realise(s2Alt1).realisation).toBe(
      "the baby is given 50ug of morphine",
    );

    const s2Alt2 = f.createClause({
      directObject: f.createNounPhraseDetNoun("the", "baby"),
      verb: "give",
      indirectObject: f.createNounPhrase("50ug of morphine"),
      subject: f.createNounPhraseDetNoun("the", "nurse"),
    });
    s2Alt2.features[Feature.PASSIVE] = true;
    expect(realiser.realise(s2Alt2).realisation).toBe(
      "the baby is given 50ug of morphine by the nurse",
    );

    const s3Alt = f.createClause({
      subject: f.createCoordinatedPhrase(
        f.createNounPhrase("my dog"),
        f.createNounPhrase("your cat"),
      ),
      verb: "chase",
      directObject: f.createNounPhrase("George"),
      frontModifier: "yesterday",
    });
    s3Alt.features[Feature.TENSE] = Tense.PAST;
    expect(realiser.realise(s3Alt).realisation).toBe(
      "yesterday my dog and your cat chased George",
    );

    // TODO: We recreate the sentence here in the Java, but we dont here, but probably should due to the side effects we have following the Java code.
    s3Alt.features[Feature.PASSIVE] = true;
    expect(realiser.realise(s3Alt).realisation).toBe(
      "yesterday George was chased by my dog and your cat",
    );

    // test correct pronoun forms
    const s4Alt1 = f.createClause(
      f.createNounPhrase("he"),
      "chase",
      f.createNounPhrase("I"),
    );
    expect(realiser.realise(s4Alt1).realisation).toBe("he chases me");

    // passive with "me"
    const s4Alt2 = f.createClause(
      f.createNounPhrase("he"),
      "chase",
      f.createNounPhrase("me"),
    );
    s4Alt2.features[Feature.PASSIVE] = true;

    expect(realiser.realise(s4Alt2).realisation).toBe("I am chased by him");

    const s4Alt3 = f.createClause("him", "chase", "I");
    expect(realiser.realise(s4Alt3).realisation).toBe("he chases me");

    const s4Alt4 = f.createClause("him", "chase", "I");
    s4Alt4.features[Feature.PASSIVE] = true;
    expect(realiser.realise(s4Alt4).realisation).toBe("I am chased by him");
  });

  test("Passive with Internal Verb Phrase Complement", () => {
    const f = context.factory;
    const vp = f.createVerbPhrase(f.createWord("upset", LexicalCategory.VERB));
    vp.addComplement(f.createNounPhraseDetNoun("the", "man"));
    const s6Alt = f.createClause(f.createNounPhraseDetNoun("the", "child"), vp);
    s6Alt.features[Feature.TENSE] = Tense.PAST;
    expect(realiser.realise(s6Alt).realisation).toBe("the child upset the man");

    s6Alt.features[Feature.PASSIVE] = true;
    expect(realiser.realise(s6Alt).realisation).toBe(
      "the man was upset by the child",
    );
  });

  test("Modal: Present", () => {
    // simple modal in present tense
    theManGivesTheWomanJohnsFlower.features[Feature.MODAL] = "should";
    expect(realiser.realise(theManGivesTheWomanJohnsFlower).realisation).toBe(
      "the man should give the woman John's flower",
    );
  });

  test("Modal: Future", () => {
    theManGivesTheWomanJohnsFlower.features[Feature.MODAL] = "should";
    theManGivesTheWomanJohnsFlower.features[Feature.TENSE] = Tense.FUTURE;
    expect(realiser.realise(theManGivesTheWomanJohnsFlower).realisation).toBe(
      "the man should give the woman John's flower",
    );
  });

  test("Modal: Present Progressive", () => {
    theManGivesTheWomanJohnsFlower.features[Feature.MODAL] = "should";
    theManGivesTheWomanJohnsFlower.features[Feature.TENSE] = Tense.FUTURE;
    theManGivesTheWomanJohnsFlower.features[Feature.PROGRESSIVE] = true;
    expect(realiser.realise(theManGivesTheWomanJohnsFlower).realisation).toBe(
      "the man should be giving the woman John's flower",
    );
  });

  test("Modal: Past", () => {
    theManGivesTheWomanJohnsFlower.features[Feature.MODAL] = "should";
    theManGivesTheWomanJohnsFlower.features[Feature.TENSE] = Tense.PAST;
    theManGivesTheWomanJohnsFlower.features[Feature.PROGRESSIVE] = false;
    expect(realiser.realise(theManGivesTheWomanJohnsFlower).realisation).toBe(
      "the man should have given the woman John's flower",
    );
  });

  test("Modal: Past Progressive", () => {
    theManGivesTheWomanJohnsFlower.features[Feature.MODAL] = "should";
    theManGivesTheWomanJohnsFlower.features[Feature.TENSE] = Tense.PAST;
    theManGivesTheWomanJohnsFlower.features[Feature.PROGRESSIVE] = true;
    expect(realiser.realise(theManGivesTheWomanJohnsFlower).realisation).toBe(
      "the man should have been giving the woman John's flower",
    );
  });

  test("Modal with Passive", () => {
    const f = context.factory;
    const object = f.createNounPhraseDetNoun("the", "pizza");
    const post = f.createAdjectivePhrase("good");
    const as = f.createAdverbPhrase("as");
    as.addComplement(post);
    const verb = f.createVerbPhrase("classify");
    verb.addPostModifier(as);
    verb.addComplement(object);
    const s = f.createClause({ verbPhrase: verb });

    s.features[Feature.MODAL] = "can";
    s.features[Feature.PASSIVE] = true;
    expect(realiser.realise(s).realisation).toBe(
      "the pizza can be classified as good",
    );
  });

  test("Passive with Prepositional Complement", () => {
    const f = context.factory;
    const subject = f.createNounPhrase("wave");
    subject.features[Feature.NUMBER] = NumberAgreement.PLURAL;
    const object = f.createNounPhrase("surfer");
    object.features[Feature.NUMBER] = NumberAgreement.PLURAL;
    const s1Alt = f.createClause(subject, "carry", object);

    const pp = f.createPrepositionPhrase(
      "to",
      f.createNounPhraseDetNoun("the", "shore"),
    );
    pp.features[InternalFeature.DISCOURSE_FUNCTION] =
      DiscourseFunction.INDIRECT_OBJECT;
    s1Alt.addComplement(pp);
    s1Alt.features[Feature.PASSIVE] = true;
    expect(realiser.realise(s1Alt).realisation).toBe(
      "surfers are carried to the shore by waves",
    );
  });

  test("Passive with Prepositional Modifier", () => {
    const f = context.factory;
    const subject = f.createNounPhrase("wave");

    subject.features[Feature.NUMBER] = NumberAgreement.PLURAL;
    const object = f.createNounPhrase("surfer");
    object.features[Feature.NUMBER] = NumberAgreement.PLURAL;
    const s1Alt = f.createClause(subject, "carry", object);
    const pp = f.createPrepositionPhrase(
      "to",
      f.createNounPhraseDetNoun("the", "shore"),
    );
    s1Alt.addPostModifier(pp);
    s1Alt.features[Feature.PASSIVE] = true;
    expect(realiser.realise(s1Alt).realisation).toBe(
      "surfers are carried to the shore by waves",
    );
  });

  test("Cue Phrase", () => {
    const f = context.factory;
    const subject = f.createNounPhrase("wave");
    subject.features[Feature.NUMBER] = NumberAgreement.PLURAL;
    const object = f.createNounPhrase("surfer");
    object.features[Feature.NUMBER] = NumberAgreement.PLURAL;
    const s1Alt = f.createClause(subject, "carry", object);
    const pp = f.createPrepositionPhrase(
      "to",
      f.createNounPhraseDetNoun("the", "shore"),
    );
    s1Alt.addPostModifier(pp);
    s1Alt.features[Feature.PASSIVE] = true;
    s1Alt.addFrontModifier("however");
    expect(realiser.realise(s1Alt).realisation).toBe(
      "however surfers are carried to the shore by waves",
    );
    realiser.commaSepCuephrase = true;
    expect(realiser.realise(s1Alt).realisation).toBe(
      "however, surfers are carried to the shore by waves",
    );
  });

  test("Set Complement", () => {
    const f = context.factory;
    const s1Alt = f.createClause({
      subject: "I",
      verb: "see",
      directObject: "a dog",
    });
    expect(realiser.realise(s1Alt).realisation).toBe("I see a dog");
    s1Alt.setObject("a cat");
    expect(realiser.realise(s1Alt).realisation).toBe("I see a cat");
    s1Alt.setObject(f.createNounPhraseDetNoun("a", "wolf"));
    expect(realiser.realise(s1Alt).realisation).toBe("I see a wolf");
  });

  test("Subclauses", () => {
    const f = context.factory;

    const acct = f.createNounPhraseDetNoun("a", "accountant");
    const sub1 = f.createVerbPhrase("call");
    sub1.addComplement("Jeff");
    sub1.features[Feature.FORM] = Form.PAST_PARTICIPLE;
    sub1.features[Feature.APPOSITIVE] = true;
    acct.addPostModifier(sub1);

    const subvp = f.createVerbPhrase("live");
    subvp.features[Feature.TENSE] = Tense.PAST;
    subvp.setComplement(
      f.createPrepositionPhrase("in", f.createNounPhraseDetNoun("a", "forest")),
    );
    const sub2 = f.createClause("who", subvp);
    acct.addPostModifier(sub2); // circular here

    const s1Alt = f.createClause("there", "be", acct);
    s1Alt.features[Feature.TENSE] = Tense.PAST;
    s1Alt.addFrontModifier("once upon a time");
    expect(realiser.realise(s1Alt).realisation).toBe(
      "once upon a time there was an accountant, called Jeff, who lived in a forest",
    );
  });
});
