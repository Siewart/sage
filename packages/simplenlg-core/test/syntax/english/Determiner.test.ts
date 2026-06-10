import data from "../../englishTestSet.js";

describe("Realiser Tests", () => {
  let d = data();
  const context = d.context;
  const realiser = d.realiser;
  const f = context.factory;
  const resetData = () => {
    d = data(d.context, d.realiser);
  };
  test("Lowercase Constant", () => {
    resetData();
    const s = f.createClause({
      directObject: f.createNounPhraseDetNoun("a", "dog"),
    });
    expect(realiser.realiseSentence(s)).toBe("A dog.");
  });

  test("Lowercase Vowel", () => {
    resetData();
    const s = f.createClause({
      directObject: f.createNounPhraseDetNoun("a", "owl"),
    });
    expect(realiser.realiseSentence(s)).toBe("An owl.");
  });

  test("Uppercase Constant", () => {
    resetData();
    const s = f.createClause({
      directObject: f.createNounPhraseDetNoun("a", "Cat"),
    });
    expect(realiser.realiseSentence(s)).toBe("A Cat.");
  });

  test("Uppercase Vowel", () => {
    resetData();
    const s = f.createClause({
      directObject: f.createNounPhraseDetNoun("a", "Emu"),
    });
    expect(realiser.realiseSentence(s)).toBe("An Emu.");
  });

  test("Numeric A", () => {
    resetData();
    const s = f.createClause({
      directObject: f.createNounPhraseDetNoun("a", "7"),
    });
    expect(realiser.realiseSentence(s)).toBe("A 7.");
  });

  test("Numeric An", () => {
    resetData();
    const s = f.createClause({
      directObject: f.createNounPhraseDetNoun("a", "11"),
    });
    expect(realiser.realiseSentence(s)).toBe("An 11.");
  });

  test("Irregular Subjects", () => {
    resetData();
    const s = f.createClause({
      directObject: f.createNounPhraseDetNoun("a", "one"),
    });
    expect(realiser.realiseSentence(s)).toBe("A one.");
  });

  test("Singular This Determiner Noun Phrase Object", () => {
    resetData();
    const s = f.createClause({
      directObject: f.createNounPhraseDetNoun("this", "monkey"),
    });
    expect(realiser.realiseSentence(s)).toBe("This monkey.");
  });

  test("Plural This Determiner Noun Phrase Object", () => {
    resetData();
    const np = f.createNounPhrase("monkey");
    np.plural = true;
    np.determiner = "this";
    const s = f.createClause({
      directObject: np,
    });
    expect(realiser.realiseSentence(s)).toBe("These monkeys.");
  });

  test("Singular That Determiner Noun Phrase Object", () => {
    resetData();
    const s = f.createClause({
      directObject: f.createNounPhraseDetNoun("that", "monkey"),
    });
    expect(realiser.realiseSentence(s)).toBe("That monkey.");
  });

  test("Plural That Determiner Noun Phrase Object", () => {
    resetData();
    const np = f.createNounPhrase("monkey");
    np.plural = true;
    np.determiner = "that";
    const s = f.createClause({
      directObject: np,
    });
    expect(realiser.realiseSentence(s)).toBe("Those monkeys.");
  });

  test("Singular These Determiner Noun Phrase Object", () => {
    resetData();
    const s = f.createClause({
      directObject: f.createNounPhraseDetNoun("these", "monkey"),
    });
    expect(realiser.realiseSentence(s)).toBe("This monkey.");
  });

  test("Plural These Determiner Noun Phrase Object", () => {
    resetData();
    const np = f.createNounPhrase("monkey");
    np.plural = true;
    np.determiner = "these";
    const s = f.createClause({
      directObject: np,
    });
    expect(realiser.realiseSentence(s)).toBe("These monkeys.");
  });

  test("Singular Those Determiner Noun Phrase Object", () => {
    resetData();
    const s = f.createClause({
      directObject: f.createNounPhraseDetNoun("those", "monkey"),
    });
    expect(realiser.realiseSentence(s)).toBe("That monkey.");
  });

  test("Plural Those Determiner Noun Phrase Object", () => {
    resetData();
    const np = f.createNounPhrase("monkey");
    np.plural = true;
    np.determiner = "those";
    const s = f.createClause({
      directObject: np,
    });
    expect(realiser.realiseSentence(s)).toBe("Those monkeys.");
  });

  // Conversion note: we dont use the NIH Database, so those tests are omitted
});
