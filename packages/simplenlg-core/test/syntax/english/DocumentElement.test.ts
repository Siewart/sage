import { SPhraseSpec } from "../../../src/phrasespec/SPhraseSpec.js";
import set from "../../englishTestSet.js";

describe("Realiser Tests", () => {
  let p1: SPhraseSpec,
    p2: SPhraseSpec,
    p3: SPhraseSpec,
    s: ReturnType<typeof set>,
    context: ReturnType<typeof set>["context"],
    realiser: ReturnType<typeof set>["realiser"];

  beforeEach(() => {
    s = set();
    context = s.context;
    realiser = s.realiser;
    const f = context.factory;

    p1 = f.createClause("you", "be", "happy");
    p2 = f.createClause("I", "be", "sad");
    p3 = f.createClause("they", "be", "nervous");
  });

  test("Basic Tests", () => {
    const f = context.factory;
    const s1 = f.createSentence(p1);
    const s2 = f.createSentence(p2);
    const s3 = f.createSentence(p3);

    const par1 = f.createParagraph([s1, s2, s3]);

    expect(realiser.realise(par1).realisation).toBe(
      "You are happy. I am sad. They are nervous.\n\n",
    );
  });

  test("Extra Whitespace", () => {
    const f = context.factory;
    const np1 = f.createNounPhraseDetNoun("a", "vessel");

    // empty coordinate as premod
    np1.setPreModifier(f.createCoordinatedPhrase());
    expect(realiser.realise(np1).realisation).toBe("a vessel");

    // empty adjP as premod
    np1.setPreModifier(f.createAdjectivePhrase(""));
    expect(realiser.realise(np1).realisation).toBe("a vessel");

    // empty string
    np1.setPreModifier("");
    expect(realiser.realise(np1).realisation).toBe("a vessel");
  });

  test("Embedding", () => {
    const f = context.factory;
    const sent = f.createSentenceCanned("This is a test");
    const sent2 = f.createSentence(f.createClause("John", "be", "missing"));
    const section = f.createSection("SECTION TITLE");
    section.addComponent(sent);
    section.addComponent(sent2);

    expect(realiser.realise(section).realisation).toBe(
      "SECTION TITLE\nThis is a test.\n\nJohn is missing.\n\n",
    );
  });

  test("Sections", () => {
    // doc which contains a section, and two paras
    const f = context.factory;
    const doc = f.createDocument("Test Document");

    const section = f.createSection("Test Section");
    doc.addComponent(section);

    const para1 = f.createParagraph();
    const sent1 = f.createSentenceCanned("This is the first test paragraph");
    para1.addComponent(sent1);
    section.addComponent(para1);

    const para2 = f.createParagraph();
    const sent2 = f.createSentenceCanned("This is the second test paragraph");
    para2.addComponent(sent2);
    section.addComponent(para2);

    expect(realiser.realise(doc).realisation).toBe(
      "Test Document\n\nTest Section\nThis is the first test paragraph.\n\nThis is the second test paragraph.\n\n",
    );
  });

  test("List Items", () => {
    const f = context.factory;
    const list = f.createList();
    list.addComponent(f.createListItem(p1));
    list.addComponent(f.createListItem(p2));
    list.addComponent(f.createListItem(f.createCoordinatedPhrase(p1, p2)));
    const realisation = realiser.realise(list).realisation;
    expect(realisation).toBe(
      "* you are happy\n* I am sad\n* you are happy and I am sad\n",
    );
  });
});
