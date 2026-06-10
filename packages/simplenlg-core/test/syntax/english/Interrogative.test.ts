import { Feature } from "../../../src/features/Feature.js";
import { InterrogativeType } from "../../../src/features/InterrogativeType.js";
import { Person } from "../../../src/features/Person.js";
import { Tense } from "../../../src/features/Tense.js";
import { LexicalCategory } from "../../../src/framework/LexicalCategory.js";
import { SPhraseSpec } from "../../../src/phrasespec/SPhraseSpec.js";
import data from "../../englishTestSet.js";

describe("Interrogative", () => {
  let s1: SPhraseSpec,
    s2: SPhraseSpec,
    s3: SPhraseSpec,
    s4: SPhraseSpec,
    context: ReturnType<typeof data>["context"],
    realiser: ReturnType<typeof data>["realiser"],
    d: ReturnType<typeof data>,
    f: ReturnType<typeof data>["context"]["factory"];

  beforeEach(() => {
    d = data();
    context = d.context;
    realiser = d.realiser;
    f = context.factory;

    // the man gives the woman John's flower
    const john = f.createNounPhrase("John");
    john.features[Feature.POSSESSIVE] = true;
    const flower = f.createNounPhrase("flower", john);
    const _woman = f.createNounPhraseDetNoun("the", "woman");
    s3 = f.createClause(d.nounPhrase.theMan, d.verbPhrase.give, flower);
    s3.setIndirectObject(_woman);

    const subjects = f.createCoordinatedPhrase(
      f.createNounPhrase("Jane"),
      f.createNounPhrase("Andrew"),
    );
    s4 = f.createClause(subjects, "pick up", "the balls");
    s4.addPostModifier("in the shop");
    s4.features[Feature.CUE_PHRASE] = f.createStringElement("however");
    s4.addFrontModifier("tomorrow");
    s4.features[Feature.TENSE] = Tense.FUTURE;
  });

  test("Simple Questions", () => {
    // simple present
    s1 = f.createClause(
      d.nounPhrase.theWoman,
      d.verbPhrase.kiss,
      d.nounPhrase.theMan,
    );
    s1.features[Feature.TENSE] = Tense.PRESENT;
    s1.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.YES_NO;
    expect(realiser.realise(s1).realisation).toBe(
      "does the woman kiss the man",
    );

    // simple past
    s1 = f.createClause(
      d.nounPhrase.theWoman,
      d.verbPhrase.kiss,
      d.nounPhrase.theMan,
    );
    s1.features[Feature.TENSE] = Tense.PAST;
    s1.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.YES_NO;
    expect(realiser.realise(s1).realisation).toBe("did the woman kiss the man");

    // copular/existential: be-fronting
    s2 = f.createClause("there", "be", d.nounPhrase.theDog);
    s2.addPostModifier(d.prepositionPhrase.onTheRock);
    s2.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.YES_NO;
    expect(realiser.realise(s2).realisation).toBe(
      "is there the dog on the rock",
    );

    // perfective
    s2 = f.createClause("there", "be", d.nounPhrase.theDog);
    s2.addPostModifier(d.prepositionPhrase.onTheRock);
    s2.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.YES_NO;
    s2.features[Feature.PERFECT] = true;
    expect(realiser.realise(s2).realisation).toBe(
      "has there been the dog on the rock",
    );

    // progressive
    const john = f.createNounPhrase("John");
    john.features[Feature.POSSESSIVE] = true;
    const flower = f.createNounPhrase("flower", john);
    const _woman = f.createNounPhraseDetNoun("the", "woman");
    s3 = f.createClause(d.nounPhrase.theMan, d.verbPhrase.give, flower);
    s3.setIndirectObject(_woman);
    s3.features[Feature.TENSE] = Tense.PAST;
    s3.features[Feature.PROGRESSIVE] = true;
    s3.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.YES_NO;
    expect(realiser.realise(s3).realisation).toBe(
      "was the man giving the woman John's flower",
    );

    // modal
    d = data();
    const flower_ = f.createNounPhrase("flower", john);
    const woman_ = f.createNounPhraseDetNoun("the", "woman");
    s3 = f.createClause(d.nounPhrase.theMan, d.verbPhrase.give, flower_);
    s3.setIndirectObject(woman_);
    s3.features[Feature.TENSE] = Tense.PAST;
    s3.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.YES_NO;
    s3.features[Feature.MODAL] = "should";
    // s3.features[Feature.PROGRESSIVE] = false;
    expect(realiser.realise(s3).realisation).toBe(
      "should the man have given the woman John's flower",
    );

    // complex case with cue phrases
    // Conversion note: the Java code precedes this part with a setUp()
    const subjects = f.createCoordinatedPhrase(
      f.createNounPhrase("Jane"),
      f.createNounPhrase("Andrew"),
    );
    s4 = f.createClause(subjects, "pick up", "the balls");
    s4.addPostModifier("in the shop");
    s4.features[Feature.CUE_PHRASE] = f.createStringElement("however,");
    s4.addFrontModifier("tomorrow");
    s4.features[Feature.TENSE] = Tense.FUTURE;
    s4.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.YES_NO;
    expect(realiser.realise(s4).realisation).toBe(
      "however, will Jane and Andrew pick up the balls in the shop tomorrow",
    );
  });

  test("Negated Questions", () => {
    // sentence: "the woman did not kiss the man"
    s1 = f.createClause(d.nounPhrase.theWoman, "kiss", d.nounPhrase.theMan);
    s1.features[Feature.TENSE] = Tense.PAST;
    s1.features[Feature.NEGATED] = true;
    s1.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.YES_NO;
    expect(realiser.realise(s1).realisation).toBe(
      "did the woman not kiss the man",
    );

    // sentence: however, tomorrow, Jane and Andrew will not pick up the balls in the shop
    const subjects = f.createCoordinatedPhrase(
      f.createNounPhrase("Jane"),
      f.createNounPhrase("Andrew"),
    );
    s4 = f.createClause(subjects, "pick up", "the balls");
    s4.addPostModifier("in the shop");
    s4.features[Feature.CUE_PHRASE] = f.createStringElement("however,");
    s4.addFrontModifier("tomorrow");
    s4.features[Feature.NEGATED] = true;
    s4.features[Feature.TENSE] = Tense.FUTURE;
    s4.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.YES_NO;
    expect(realiser.realise(s4).realisation).toBe(
      "however, will Jane and Andrew not pick up the balls in the shop tomorrow",
    );
  });

  test("Coordinate VP Questions", () => {
    // create a complex vp: "kiss the dog and walk in the room"
    const kiss = d.verbPhrase.kiss;
    const walk = d.verbPhrase.walk;
    const complex = f.createCoordinatedPhrase(kiss, walk);
    kiss.addComplement(d.nounPhrase.theDog);
    walk.addComplement(d.prepositionPhrase.inTheRoom);

    // sentence: "However, tomorrow, Jane and Andrew will kiss the dog and will walk in the room"
    const subjects = f.createCoordinatedPhrase(
      f.createNounPhrase("Jane"),
      f.createNounPhrase("Andrew"),
    );
    s4 = f.createClause(subjects, complex);
    s4.features[Feature.CUE_PHRASE] = f.createStringElement("however");
    s4.addFrontModifier("tomorrow");
    s4.features[Feature.TENSE] = Tense.FUTURE;
    expect(realiser.realise(s4).realisation).toBe(
      "however tomorrow Jane and Andrew will kiss the dog and will walk in the room",
    );

    // setting to interrogative should automatically give us a single, wide-scope aux
    s4 = f.createClause(subjects, complex);
    s4.features[Feature.CUE_PHRASE] = f.createStringElement("however");
    s4.addFrontModifier("tomorrow");
    s4.features[Feature.TENSE] = Tense.FUTURE;
    s4.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.YES_NO;
    expect(realiser.realise(s4).realisation).toBe(
      "however will Jane and Andrew kiss the dog and walk in the room tomorrow",
    );

    // slightly more complex -- perfective
    s4 = f.createClause(subjects, complex);
    s4.features[Feature.CUE_PHRASE] = f.createStringElement("however");
    s4.addFrontModifier("tomorrow");
    s4.features[Feature.TENSE] = Tense.FUTURE;
    s4.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.YES_NO;
    s4.features[Feature.PERFECT] = true;
    expect(realiser.realise(s4).realisation).toBe(
      "however will Jane and Andrew have kissed the dog and walked in the room tomorrow",
    );
  });

  test("Simple Questions 2", () => {
    let s = f.createClause("the woman", "kiss", "the man");

    // try with the simple yes/no type first
    s.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.YES_NO;
    expect(realiser.realise(s).realisation).toBe("does the woman kiss the man");

    // now in the passive
    s = f.createClause("the woman", "kiss", "the man");
    s.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.YES_NO;
    s.features[Feature.PASSIVE] = true;
    expect(realiser.realise(s).realisation).toBe(
      "is the man kissed by the woman",
    );

    // subject interrogative with simple present
    s = f.createClause("the woman", "kiss", "the man");
    s.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHO_SUBJECT;
    expect(realiser.realise(s).realisation).toBe("who kisses the man");

    // object interrogative with simple present
    s = f.createClause("the woman", "kiss", "the man");
    s.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHO_OBJECT;
    expect(realiser.realise(s).realisation).toBe("who does the woman kiss");

    // subject interrogative with passive
    s = f.createClause("the woman", "kiss", "the man");
    s.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHO_SUBJECT;
    s.features[Feature.PASSIVE] = true;
    expect(realiser.realise(s).realisation).toBe("who is the man kissed by");
  });

  test("WH Questions 1", () => {
    // subject interrogative
    s4.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHO_SUBJECT;
    expect(realiser.realise(s4).realisation).toBe(
      "however who will pick up the balls in the shop tomorrow",
    );
  });

  test("WH Questions 2", () => {
    // subject interrogative in passive
    s4.features[Feature.PASSIVE] = true;
    s4.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHO_SUBJECT;
    expect(realiser.realise(s4).realisation).toBe(
      "however who will the balls be picked up in the shop by tomorrow",
    );
  });

  test("WH Questions 3", () => {
    // object interrogative
    s4.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHAT_OBJECT;
    s4.features[Feature.PASSIVE] = false;
    expect(realiser.realise(s4).realisation).toBe(
      "however what will Jane and Andrew pick up in the shop tomorrow",
    );
  });

  test("WH Questions 4", () => {
    // object interrogative with passive
    s4.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHAT_OBJECT;
    s4.features[Feature.PASSIVE] = true;
    expect(realiser.realise(s4).realisation).toBe(
      "however what will be picked up in the shop by Jane and Andrew tomorrow",
    );
  });

  test("WH Questions 5", () => {
    // how-question + passive
    s4.features[Feature.PASSIVE] = true;
    s4.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.HOW;
    expect(realiser.realise(s4).realisation).toBe(
      "however how will the balls be picked up in the shop by Jane and Andrew tomorrow",
    );
  });

  test("WH Questions 6", () => {
    // why-question + passive
    s4.features[Feature.PASSIVE] = true;
    s4.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHY;
    expect(realiser.realise(s4).realisation).toBe(
      "however why will the balls be picked up in the shop by Jane and Andrew tomorrow",
    );
  });

  test("WH Questions 7", () => {
    // how question with modal
    s4.features[Feature.PASSIVE] = true;
    s4.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.HOW;
    s4.features[Feature.MODAL] = "should";
    expect(realiser.realise(s4).realisation).toBe(
      "however how should the balls be picked up in the shop by Jane and Andrew tomorrow",
    );
  });

  test("WH Questions 8", () => {
    // indirect object
    s3.features[Feature.INTERROGATIVE_TYPE] =
      InterrogativeType.WHO_INDIRECT_OBJECT;
    expect(realiser.realise(s3).realisation).toBe(
      "who does the man give John's flower to",
    );
  });

  test("Progressive WH Subject Questions", () => {
    const p = f.createClause({
      subject: "Mary",
      verb: "eat",
      directObject: f.createNounPhraseDetNoun("the", "pie"),
    });

    p.features[Feature.PROGRESSIVE] = true;
    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHO_SUBJECT;
    expect(realiser.realise(p).realisation).toBe("who is eating the pie");
  });

  test("Progressive WH Object Questions", () => {
    const p = f.createClause({
      subject: "Mary",
      verb: "eat",
      directObject: f.createNounPhraseDetNoun("the", "pie"),
    });

    p.features[Feature.PROGRESSIVE] = true;
    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHAT_OBJECT;
    expect(realiser.realise(p).realisation).toBe("what is Mary eating");

    // Conversion note: Commented out in the og Java, we may need it later and have a comment for it in VerbPhraseHelper:createVerbGroup
    // const p2 = f.createClause({
    //   subject: "Mary",
    //   verb: "eat",
    //   directObject: f.createNounPhraseDetNoun("the", "pie")
    // });
    // p2.features[Feature.PROGRESSIVE] = true;
    // p2.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHAT_OBJECT;
    // p2.features[Feature.NEGATED] = true;
    // expect(realiser.realise(p2).realisation).toBe("what is Mary not eating");
  });

  test("Negated WH Subject Questions", () => {
    const p = f.createClause({
      subject: "Mary",
      verb: "eat",
      directObject: f.createNounPhraseDetNoun("the", "pie"),
    });
    p.features[Feature.NEGATED] = true;
    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHO_SUBJECT;
    expect(realiser.realise(p).realisation).toBe("who does not eat the pie");
  });

  test("Negated WH Object Questions", () => {
    const p = f.createClause({
      subject: "Mary",
      verb: "eat",
      directObject: f.createNounPhraseDetNoun("the", "pie"),
    });
    p.features[Feature.NEGATED] = true;
    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHAT_OBJECT;
    expect(realiser.realise(p).realisation).toBe("what does Mary not eat");
  });

  test("Tutorial Questions", () => {
    let p = f.createClause("Mary", "chase", "George");
    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.YES_NO;
    expect(realiser.realise(p).realisation).toBe("does Mary chase George");

    p = f.createClause("Mary", "chase", "George");
    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHO_OBJECT;
    expect(realiser.realise(p).realisation).toBe("who does Mary chase");
  });

  test("Modal WH Subject Question", () => {
    const p = f.createClause(d.nounPhrase.theDog, "upset", d.nounPhrase.theMan);
    p.features[Feature.TENSE] = Tense.PAST;
    expect(realiser.realise(p).realisation).toBe("the dog upset the man");

    // first without modal
    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHO_SUBJECT;
    expect(realiser.realise(p).realisation).toBe("who upset the man");

    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHAT_SUBJECT;
    expect(realiser.realise(p).realisation).toBe("what upset the man");

    // now with modal auxiliary
    p.features[Feature.MODAL] = "may";

    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHO_SUBJECT;
    expect(realiser.realise(p).realisation).toBe("who may have upset the man");

    p.features[Feature.TENSE] = Tense.FUTURE;
    expect(realiser.realise(p).realisation).toBe("who may upset the man");

    p.features[Feature.TENSE] = Tense.PAST;
    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHAT_SUBJECT;
    expect(realiser.realise(p).realisation).toBe("what may have upset the man");

    p.features[Feature.TENSE] = Tense.FUTURE;
    expect(realiser.realise(p).realisation).toBe("what may upset the man");
  });

  test("Modal WH Object Question", () => {
    const p = f.createClause(d.nounPhrase.theDog, "upset", d.nounPhrase.theMan);
    p.features[Feature.TENSE] = Tense.PAST;
    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHO_OBJECT;

    expect(realiser.realise(p).realisation).toBe("who did the dog upset");

    p.features[Feature.MODAL] = "may";
    expect(realiser.realise(p).realisation).toBe("who may the dog have upset");

    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHAT_OBJECT;
    expect(realiser.realise(p).realisation).toBe("what may the dog have upset");

    p.features[Feature.TENSE] = Tense.FUTURE;
    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHO_OBJECT;
    expect(realiser.realise(p).realisation).toBe("who may the dog upset");

    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHAT_OBJECT;
    expect(realiser.realise(p).realisation).toBe("what may the dog upset");
  });

  test("Aux WH Subject Question", () => {
    const p = f.createClause(d.nounPhrase.theDog, "upset", d.nounPhrase.theMan);
    p.features[Feature.TENSE] = Tense.PRESENT;
    p.features[Feature.PERFECT] = true;
    expect(realiser.realise(p).realisation).toBe("the dog has upset the man");

    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHO_SUBJECT;
    expect(realiser.realise(p).realisation).toBe("who has upset the man");

    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHAT_SUBJECT;
    expect(realiser.realise(p).realisation).toBe("what has upset the man");
  });

  test("Aux WH Object Question", () => {
    const p = f.createClause(d.nounPhrase.theDog, "upset", d.nounPhrase.theMan);

    // first without any aux
    p.features[Feature.TENSE] = Tense.PAST;
    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHAT_OBJECT;
    expect(realiser.realise(p).realisation).toBe("what did the dog upset");

    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHO_OBJECT;
    expect(realiser.realise(p).realisation).toBe("who did the dog upset");

    p.features[Feature.TENSE] = Tense.PRESENT;
    p.features[Feature.PERFECT] = true;

    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHO_OBJECT;
    expect(realiser.realise(p).realisation).toBe("who has the dog upset");

    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHAT_OBJECT;
    expect(realiser.realise(p).realisation).toBe("what has the dog upset");

    p.features[Feature.TENSE] = Tense.FUTURE;
    p.features[Feature.PERFECT] = true;

    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHO_OBJECT;
    expect(realiser.realise(p).realisation).toBe("who will the dog have upset");

    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHAT_OBJECT;
    expect(realiser.realise(p).realisation).toBe(
      "what will the dog have upset",
    );
  });

  test("Be Questions", () => {
    const p = f.createClause(
      f.createNounPhraseDetNoun("a", "ball"),
      f.createWord("be", LexicalCategory.VERB),
      f.createNounPhraseDetNoun("a", "toy"),
    );

    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHAT_OBJECT;
    expect(realiser.realise(p).realisation).toBe("what is a ball");

    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.YES_NO;
    expect(realiser.realise(p).realisation).toBe("is a ball a toy");

    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHAT_SUBJECT;
    expect(realiser.realise(p).realisation).toBe("what is a toy");

    const p2 = f.createClause("Mary", "be", "beautiful");
    p2.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHY;
    expect(realiser.realise(p2).realisation).toBe("why is Mary beautiful");

    p2.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHERE;
    expect(realiser.realise(p2).realisation).toBe("where is Mary beautiful");

    p2.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHO_SUBJECT;
    expect(realiser.realise(p2).realisation).toBe("who is beautiful");
  });

  test("Be Questions Future", () => {
    const p = f.createClause(
      f.createNounPhraseDetNoun("a", "ball"),
      f.createWord("be", LexicalCategory.VERB),
      f.createNounPhraseDetNoun("a", "toy"),
    );
    p.features[Feature.TENSE] = Tense.FUTURE;

    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHAT_OBJECT;
    expect(realiser.realise(p).realisation).toBe("what will a ball be");

    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.YES_NO;
    expect(realiser.realise(p).realisation).toBe("will a ball be a toy");

    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHAT_SUBJECT;
    expect(realiser.realise(p).realisation).toBe("what will be a toy");

    const p2 = f.createClause("Mary", "be", "beautiful");
    p2.features[Feature.TENSE] = Tense.FUTURE;
    p2.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHY;
    expect(realiser.realise(p2).realisation).toBe("why will Mary be beautiful");

    p2.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHERE;
    expect(realiser.realise(p2).realisation).toBe(
      "where will Mary be beautiful",
    );

    p2.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHO_SUBJECT;
    expect(realiser.realise(p2).realisation).toBe("who will be beautiful");
  });

  test("Be Questions Past", () => {
    const p = f.createClause(
      f.createNounPhraseDetNoun("a", "ball"),
      f.createWord("be", LexicalCategory.VERB),
      f.createNounPhraseDetNoun("a", "toy"),
    );
    p.features[Feature.TENSE] = Tense.PAST;

    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHAT_OBJECT;
    expect(realiser.realise(p).realisation).toBe("what was a ball");

    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.YES_NO;
    expect(realiser.realise(p).realisation).toBe("was a ball a toy");

    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHAT_SUBJECT;
    expect(realiser.realise(p).realisation).toBe("what was a toy");

    const p2 = f.createClause("Mary", "be", "beautiful");
    p2.features[Feature.TENSE] = Tense.PAST;
    p2.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHY;
    expect(realiser.realise(p2).realisation).toBe("why was Mary beautiful");

    p2.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHERE;
    expect(realiser.realise(p2).realisation).toBe("where was Mary beautiful");

    p2.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHO_SUBJECT;
    expect(realiser.realise(p2).realisation).toBe("who was beautiful");
  });

  test("Simple Be WH Questions", () => {
    const p = f.createClause("I", "be");

    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHERE;
    expect(realiser.realiseSentence(p)).toBe("Where am I?");

    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHY;
    expect(realiser.realiseSentence(p)).toBe("Why am I?");

    p.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.HOW;
    expect(realiser.realiseSentence(p)).toBe("How am I?");
  });

  test("How Predicate Question", () => {
    const subject = f.createNounPhrase("You");

    subject.features[Feature.PRONOMINAL] = true;
    subject.features[Feature.PERSON] = Person.SECOND;

    const test = f.createClause({
      subject: subject,
      verb: "be",
    });

    test.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.HOW_PREDICATE;
    test.features[Feature.TENSE] = Tense.PRESENT;

    expect(realiser.realiseSentence(test)).toBe("How are you?");
  });

  test("What Object Interrogative", () => {
    // Case 1, no object is explicitly given:
    const clause = f.createClause("you", "think");
    const aboutJohn = f.createPrepositionPhrase("about", "John");
    clause.addPostModifier(aboutJohn);
    clause.features[Feature.INTERROGATIVE_TYPE] = InterrogativeType.WHAT_OBJECT;
    expect(realiser.realiseSentence(clause)).toBe(
      "What do you think about John?",
    );

    // Case 2:
    // Add "bad things" as the object so the object doesn't remain null:
    clause.setObject("bad things");
    expect(realiser.realiseSentence(clause)).toBe(
      "What do you think about John?",
    );
  });
});
