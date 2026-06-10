import { readFileSync } from "fs";
import { defaultEnglishContext } from "simplenlg-core/factory";
import { Realiser } from "simplenlg-core";
import { Unwrapper } from "../src/Unwrapper.js";
import { NLGSpecType } from "../src/zod/XMLRequest.js";

describe("XML Realiser Tests", () => {
  const unwrapper = new Unwrapper(defaultEnglishContext);
  const openFile = (fileName: string) => {
    const xmlContent = readFileSync(fileName, "utf-8");
    const nlgSpec = unwrapper.parse(xmlContent).NLGSpec;
    return nlgSpec;
  };

  const parseRecording = (nlgSpec: NLGSpecType["NLGSpec"]) => {
    if ("Recording" in nlgSpec) {
      const records = nlgSpec.Recording.Record;
      const results = records.map((record) => {
        const t = unwrapper.unwrapDocumentElement(record.Document);
        const realiser = Realiser.create(defaultEnglishContext);
        const result = realiser.realise(t);
        return { result, realisation: record.Realisation };
      });
      return results;
    }
    return undefined;
  };

  const parseRequest = (nlgSpec: NLGSpecType["NLGSpec"]) => {
    if ("Request" in nlgSpec) {
      const t = unwrapper.unwrapDocumentElement(nlgSpec.Request.Document);
      const realiser = Realiser.create(defaultEnglishContext);
      const result = realiser.realise(t);
      return result;
    }
    return undefined;
  };

  test("Recording", () => {
    const nlgSpec = openFile("test/resources/Recording.xml");
    const result = parseRecording(nlgSpec);
    expect(result?.length).toBe(1);
    expect(result?.[0]?.result).toBeDefined();
    expect(result?.[0]?.result.realisation.trim()).toBe("Hello, world.");
  });

  test("Request", () => {
    const nlgSpec = openFile("test/resources/Request.xml");
    const result = parseRequest(nlgSpec);
    expect(result).toBeDefined();
    expect(result?.realisation.trim()).toBe("Hello, world.");
  });

  test("Appositive", () => {
    const nlgSpec = openFile("test/resources/AppositiveTest.xml");
    const results = parseRecording(nlgSpec);
    expect(results).toBeDefined();
    expect(results?.length).toBe(1);
    results?.forEach((result) => {
      // Conversion note: it would be nice to use test.each here
      expect(result.result).toBeDefined();
      expect(result.realisation).toBeDefined();
      expect(result.result.realisation.trim()).toBe(result.realisation?.trim());
    });
  });

  test("Clause", () => {
    const nlgSpec = openFile("test/resources/ClauseTest.xml");
    const results = parseRecording(nlgSpec);
    expect(results).toBeDefined();
    expect(results?.length).toBe(23);
    results?.forEach((result) => {
      expect(result.result).toBeDefined();
      expect(result.realisation).toBeDefined();
      // TODO (debug): The current issue is that the VP doesnt get its Tense set, thus the go verb does not get it either.
      // This done in the coordinatedphrase in Java
      // Which needs it to be set for it as well, CoordinatedPhraseElement:setChildFeatures

      // Turns out that the SPhrase doesn't set the tense to the coordinatephraseelement when created
      // Need to set a breakpoint on Unwrapper setSFeatures, but the jest plugin is no longer loading
      expect(result.result.realisation.trim()).toBe(result.realisation?.trim());
    });
  });

  test("Coordinated Phrase Negation", () => {
    const nlgSpec = openFile("test/resources/CoordPhraseNegationTest.xml");
    const results = parseRecording(nlgSpec);
    expect(results).toBeDefined();
    expect(results?.length).toBe(2);
    results?.forEach((result) => {
      expect(result.result).toBeDefined();
      expect(result.realisation).toBeDefined();
      expect(result.result.realisation.trim()).toBe(result.realisation?.trim());
    });
  });

  test("Coordinated Phrase", () => {
    const nlgSpec = openFile("test/resources/CoordPhraseTest.xml");
    const results = parseRecording(nlgSpec);
    expect(results).toBeDefined();
    expect(results?.length).toBe(1);
    results?.forEach((result) => {
      expect(result.result).toBeDefined();
      expect(result.realisation).toBeDefined();
      expect(result.result.realisation.trim()).toBe(result.realisation?.trim());
    });
  });

  test("Formatting", () => {
    const nlgSpec = openFile("test/resources/FormattingTest.xml");
    const results = parseRecording(nlgSpec);
    expect(results).toBeDefined();
    expect(results?.length).toBe(3); // Commented out out since the XML Lexicon is not as extensive as the NIHDB Lexicon
    results?.forEach((result) => {
      expect(result.result).toBeDefined();
      expect(result.realisation).toBeDefined();
      expect(result.result.realisation.trim()).toBe(result.realisation?.trim());
    });
  });

  test("Interrogative", () => {
    const nlgSpec = openFile("test/resources/InterrogativeTest.xml");
    const results = parseRecording(nlgSpec);
    expect(results).toBeDefined();
    expect(results?.length).toBe(1);
    results?.forEach((result) => {
      expect(result.result).toBeDefined();
      expect(result.realisation).toBeDefined();
      expect(result.result.realisation.trim()).toBe(result.realisation?.trim());
    });
  });

  test("Lexical Variation", () => {
    const nlgSpec = openFile("test/resources/LexicalVariationTest.xml");
    const results = parseRecording(nlgSpec);
    expect(results).toBeDefined();
    expect(results?.length).toBe(3);
    results?.forEach((result) => {
      expect(result.result).toBeDefined();
      expect(result.realisation).toBeDefined();
      expect(result.result.realisation.trim()).toBe(result.realisation?.trim());
    });
  });

  test("Multi Document", () => {
    const nlgSpec = openFile("test/resources/MultiDocumentTest.xml");
    const results = parseRecording(nlgSpec);
    expect(results).toBeDefined();
    expect(results?.length).toBe(2);
    results?.forEach((result) => {
      expect(result.result).toBeDefined();
      expect(result.realisation).toBeDefined();
      expect(result.result.realisation.trim()).toBe(result.realisation?.trim());
    });
  });

  test("Multi Sentence", () => {
    const nlgSpec = openFile("test/resources/MultiSentenceTest.xml");
    const results = parseRecording(nlgSpec);
    expect(results).toBeDefined();
    expect(results?.length).toBe(1);
    results?.forEach((result) => {
      expect(result.result).toBeDefined();
      expect(result.realisation).toBeDefined();
      expect(result.result.realisation.trim()).toBe(result.realisation?.trim());
    });
  });

  test("Noun Phrase", () => {
    const nlgSpec = openFile("test/resources/NounPhraseTest.xml");
    const results = parseRecording(nlgSpec);
    expect(results).toBeDefined();
    expect(results?.length).toBe(11);
    results?.forEach((result) => {
      expect(result.result).toBeDefined();
      expect(result.realisation).toBeDefined();
      expect(result.result.realisation.trim()).toBe(result.realisation?.trim());
    });
  });

  test("Perfect Passive", () => {
    const nlgSpec = openFile("test/resources/PerfectPassiveTest.xml");
    const result = parseRequest(nlgSpec);
    expect(result).toBeDefined();
    expect(result?.realisation.trim()).toBe(result?.realisation?.trim());
  });

  test("Simple Client", () => {
    const nlgSpec = openFile("test/resources/XMLSimpleClientTest.xml");
    const result = parseRequest(nlgSpec);
    expect(result).toBeDefined();
    expect(result?.realisation.trim()).toBe(result?.realisation?.trim());
  });
});
