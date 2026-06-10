import { Feature } from "../../../src/features/Feature.js";
import { Tense } from "../../../src/features/Tense.js";
import { LexicalCategory } from "../../../src/framework/LexicalCategory.js";
import data from "../../englishTestSet.js";

describe("Coordination", () => {
  let d = data();
  const context = d.context;
  const realiser = d.realiser;
  const f = context.factory;
  const resetData = () => {
    d = data(d.context, d.realiser);
  };
  test("Empty Coordination", () => {
    resetData();
    const coord = f.createCoordinatedPhrase();
    expect(realiser.realise(coord).realisation).toBe("");

    coord.addPreModifier(f.createAdjectivePhrase("nice"));
    expect(realiser.realise(coord).realisation).toBe("nice");
  });

  test("Modified Coordinated Verb Phrase", () => {
    resetData();
    const coord = f.createCoordinatedPhrase(
      d.verbPhrase.getUp,
      d.verbPhrase.fallDown,
    );
    coord.features[Feature.TENSE] = Tense.PAST;
    expect(realiser.realise(coord).realisation).toBe("got up and fell down");

    coord.addPreModifier("slowly");
    expect(realiser.realise(coord).realisation).toBe(
      "slowly got up and fell down",
    );

    coord.addPostModifier(d.prepositionPhrase.behindTheCurtain);
    expect(realiser.realise(coord).realisation).toBe(
      "slowly got up and fell down behind the curtain",
    );

    const s = f.createClause("Jake", coord);
    s.features[Feature.TENSE] = Tense.PAST;
    expect(realiser.realise(s).realisation).toBe(
      "Jake slowly got up and fell down behind the curtain",
    );

    s.addPreModifier(
      context.lexicon.getWordFromVariant("however", LexicalCategory.ADVERB),
    );
    expect(realiser.realise(s).realisation).toBe(
      "Jake however slowly got up and fell down behind the curtain",
    );

    s.addPostModifier(d.prepositionPhrase.inTheRoom);
    expect(realiser.realise(s).realisation).toBe(
      "Jake however slowly got up and fell down behind the curtain in the room",
    );
  });

  test("Coordinate Verb Phrase Complex Subject", () => {
    resetData();

    const vp1 = f.createVerbPhrase(
      context.lexicon.getWordFromVariant("have", LexicalCategory.VERB),
    );
    const np1 = f.createNounPhraseDetNoun(
      "a",
      context.lexicon.getWordFromVariant(
        "contrast media reaction",
        LexicalCategory.NOUN,
      ),
    ); // Conversion note: likely a word from the NIH database which we don't support
    np1.addPreModifier(
      context.lexicon.getWordFromVariant("adverse", LexicalCategory.ADJECTIVE),
    );
    vp1.addComplement(np1);

    const vp2 = f.createVerbPhrase(
      context.lexicon.getWordFromVariant("go", LexicalCategory.VERB),
    );
    const pp = f.createPrepositionPhrase(
      "into",
      context.lexicon.getWordFromVariant(
        "cardiogenic shock",
        LexicalCategory.NOUN,
      ),
    ); // Conversion note: likely a word from the NIH database which we don't support
    vp2.addComplement(pp);

    const coord = f.createCoordinatedPhrase(vp1, vp2);
    coord.features[Feature.TENSE] = Tense.PAST;
    expect(realiser.realise(coord).realisation).toBe(
      "had an adverse contrast media reaction and went into cardiogenic shock",
    );

    const s = f.createClause({
      subject: f.createNounPhraseDetNoun("the", "patient"),
      verbPhrase: coord,
    });
    s.addFrontModifier("As a result of the procedure");

    expect(realiser.realise(s).realisation).toBe(
      "As a result of the procedure the patient had an adverse contrast media reaction and went into cardiogenic shock",
    );
  });

  test("Null Conjunction", () => {
    resetData();
    const p = f.createClause("I", "be", "happy");
    const q = f.createClause("I", "eat", "fish");
    const pq = f.createCoordinatedPhrase();
    pq.addCoordinate(p);
    pq.addCoordinate(q);
    pq.features[Feature.CONJUNCTION] = "";
    expect(realiser.realise(pq).realisation).toBe("I am happy I eat fish");

    // Conversion note: we don't allow Conjuctions to be null, so we cannot fully port the test (but not allowing it is the reason this tests exists I expect)
  });

  test("Negation Feature", () => {
    resetData();
    const s1 = f.createClause("he", "have", "asthma");
    const s2 = f.createClause("he", "have", "diabetes");
    s1.features[Feature.NEGATED] = true;
    const coord = f.createCoordinatedPhrase(s1, s2);
    expect(realiser.realise(coord).realisation).toBe(
      "he does not have asthma and he has diabetes",
    );
    coord.conjunction = "but";
    expect(realiser.realise(coord).realisation).toBe(
      "he does not have asthma but he has diabetes",
    ); // Conversion note: added because of interest in the current project
  });
});
