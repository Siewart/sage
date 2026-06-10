import { BackwardConjunctionReductionRule } from "../../../src/aggregation/BackwardConjunctionReductionRule.js";
import { ClauseCoordinationRule } from "../../../src/aggregation/ClauseCoordinationRule.js";
import { ForwardConjunctionReductionRule } from "../../../src/aggregation/ForwardConjunctionReductionRule.js";
import { Feature } from "../../../src/features/Feature.js";
import { NLGElement } from "../../../src/framework/NLGElement.js";
import { SPhraseSpec } from "../../../src/phrasespec/SPhraseSpec.js";

import set from "../../englishTestSet.js";

describe("Clause Aggregation", () => {
  let theWomanKissesTheManBehindTheCurtain: SPhraseSpec,
    theWomanKicksTheDogOnTheRock: SPhraseSpec,
    theWomanKicksTheDogBehindTheCurtain: SPhraseSpec,
    theManKicksTheDogBehindTheCurtain: SPhraseSpec,
    theGirlKicksTheDogBehindTheCurtain: SPhraseSpec,
    theWomanKissesTheDogBehindTheCurtain: SPhraseSpec,
    coord: ClauseCoordinationRule,
    fcr: ForwardConjunctionReductionRule,
    bcr: BackwardConjunctionReductionRule,
    context: ReturnType<typeof set>["context"],
    realiser: ReturnType<typeof set>["realiser"];

  beforeEach(() => {
    const s = set();

    context = s.context;
    realiser = s.realiser;
    const f = context.factory;
    coord = ClauseCoordinationRule.create(context);
    fcr = ForwardConjunctionReductionRule.create(context);
    bcr = BackwardConjunctionReductionRule.create(context);

    // Some additional elements are made here so they are distinct objects so elision isn't shared. (Not an ideal trait, but it's how the Java code is written.)
    theWomanKissesTheManBehindTheCurtain = f.createClause(
      s.nounPhrase.theWoman,
      f.createVerbPhrase("kiss"),
      s.nounPhrase.theMan,
    );
    theWomanKissesTheManBehindTheCurtain.addPostModifier(
      f.createPrepositionPhrase(
        "behind",
        f.createNounPhraseDetNoun("the", "curtain"),
      ),
    );

    theWomanKicksTheDogOnTheRock = f.createClause(
      f.createNounPhraseDetNoun("the", "woman"),
      f.createVerbPhrase("kick"),
      f.createNounPhraseDetNoun("the", "dog"),
    );
    theWomanKicksTheDogOnTheRock.addPostModifier(s.prepositionPhrase.onTheRock);

    theWomanKicksTheDogBehindTheCurtain = context.factory.createClause(
      f.createNounPhraseDetNoun("the", "woman"),
      f.createVerbPhrase("kick"),
      f.createNounPhraseDetNoun("the", "dog"),
    );
    theWomanKicksTheDogBehindTheCurtain.addPostModifier(
      f.createPrepositionPhrase(
        "behind",
        f.createNounPhraseDetNoun("the", "curtain"),
      ),
    );

    theManKicksTheDogBehindTheCurtain = context.factory.createClause(
      s.nounPhrase.theMan,
      f.createVerbPhrase("kick"),
      f.createNounPhraseDetNoun("the", "dog"),
    );
    theManKicksTheDogBehindTheCurtain.addPostModifier(
      s.prepositionPhrase.behindTheCurtain,
    );

    theGirlKicksTheDogBehindTheCurtain = context.factory.createClause(
      f.createNounPhraseDetNoun("the", "girl"),
      f.createVerbPhrase("kick"),
      f.createNounPhraseDetNoun("the", "dog"),
    );
    theGirlKicksTheDogBehindTheCurtain.addPostModifier(
      s.prepositionPhrase.behindTheCurtain,
    );

    theWomanKissesTheDogBehindTheCurtain = context.factory.createClause(
      f.createNounPhraseDetNoun("the", "woman"),
      f.createVerbPhrase("kiss"),
      f.createNounPhraseDetNoun("the", "dog"),
    );
    theWomanKissesTheDogBehindTheCurtain.addPostModifier(
      f.createPrepositionPhrase(
        "behind",
        f.createNounPhraseDetNoun("the", "curtain"),
      ),
    );
  });

  test("Coordination Same Subject Length", () => {
    const elements = [
      theWomanKissesTheManBehindTheCurtain,
      theWomanKicksTheDogOnTheRock,
    ];
    const result = coord.applyAllAggregation(elements);
    expect(result.length).toBe(2);
    expect(realiser.realise(result[0] as NLGElement).realisation).toBe(
      "the woman kisses the man behind the curtain",
    );
    expect(realiser.realise(result[1] as NLGElement).realisation).toBe(
      "the woman kicks the dog on the rock",
    );
  });

  test("Coordination Passive Length", () => {
    theWomanKissesTheManBehindTheCurtain.features[Feature.PASSIVE] = true;
    const elements = [
      theWomanKissesTheManBehindTheCurtain,
      theWomanKicksTheDogOnTheRock,
    ];
    const result = coord.applyAllAggregation(elements);
    expect(result.length).toBe(2);
    expect(realiser.realise(result[0] as NLGElement).realisation).toBe(
      "the man is kissed behind the curtain by the woman",
    );
    expect(realiser.realise(result[1] as NLGElement).realisation).toBe(
      "the woman kicks the dog on the rock",
    );
  });
  // TODO (debug): this test is commented out in the original Java source, and fails in both Java and TS.
  // test("Coordination Same Subject", () => {
  //   const elements = [
  //     theWomanKissesTheManBehindTheCurtain,
  //     theWomanKicksTheDogBehindTheCurtain,
  //   ];
  //   const result = coord.applyAllAggregation(elements);
  //   expect(result.length).toBe(1);
  //   const aggregated = result[0] as NLGElement;
  //   expect(realiser.realise(aggregated).realisation).toBe(
  //     "the woman kisses the man and kicks the dog behind the curtain",
  //   );
  // });

  test("Coordination Same VP", () => {
    const elements = [
      theWomanKicksTheDogBehindTheCurtain,
      theManKicksTheDogBehindTheCurtain,
    ];
    const result = coord.applyAllAggregation(elements);
    expect(result.length).toBe(1);
    const aggregated = result[0];
    expect(realiser.realise(aggregated as NLGElement).realisation).toBe(
      "the woman and the man kick the dog behind the curtain",
    );
  });

  test("Coordination With Modifiers", () => {
    theWomanKicksTheDogBehindTheCurtain.addFrontModifier(
      context.factory.createAdverbPhrase("however"),
    );
    theManKicksTheDogBehindTheCurtain.addFrontModifier(
      context.factory.createAdverbPhrase("however"),
    );
    const elements = [
      theWomanKicksTheDogBehindTheCurtain,
      theManKicksTheDogBehindTheCurtain,
    ];
    const result = coord.applyAllAggregation(elements);
    expect(result.length).toBe(1);
    const aggregated = result[0];
    expect(realiser.realise(aggregated as NLGElement).realisation).toBe(
      "however the woman and the man kick the dog behind the curtain",
    );
  });

  test("Coordination Same VP With Three Sentences", () => {
    const elements = [
      theWomanKicksTheDogBehindTheCurtain,
      theManKicksTheDogBehindTheCurtain,
      theGirlKicksTheDogBehindTheCurtain,
    ];
    const result = coord.applyAllAggregation(elements);
    expect(result.length).toBe(1);
    const aggregated = result[0];
    expect(realiser.realise(aggregated as NLGElement).realisation).toBe(
      "the woman and the man and the girl kick the dog behind the curtain",
    );
  });

  test("Forward Conjunction Reduction", () => {
    const aggregated = fcr.applyAggregation(
      theWomanKicksTheDogOnTheRock,
      theWomanKicksTheDogBehindTheCurtain,
    );
    expect(realiser.realise(aggregated as NLGElement).realisation).toBe(
      "the woman kicks the dog on the rock and kicks the dog behind the curtain",
    );
  });

  test("Backward Conjunction Reduction", () => {
    const aggregated = bcr.applyAggregation(
      theWomanKicksTheDogBehindTheCurtain,
      theWomanKissesTheDogBehindTheCurtain,
    );
    expect(realiser.realise(aggregated as NLGElement).realisation).toBe(
      "the woman kicks and the woman kisses the dog behind the curtain",
    );
  });

  // TODO (debug): this test is commented out in the original Java source, and fails in both Java and TS.
  // test("Forward Backward Conjunction Reduction", () => {
  //   const aggregator = Aggregator.create(context);

  //   aggregator.addRule(fcr);
  //   aggregator.addRule(bcr);
  //   realiser.debugMode = true;
  //   const elements = [
  //     theWomanKicksTheDogOnTheRock,
  //     theWomanKicksTheDogBehindTheCurtain,
  //   ];
  //   const result = aggregator.realiseAll(elements);
  //   expect(result.length).toBe(1);
  //   const aggregated = context.factory.createCoordinatedPhrase(
  //     theWomanKicksTheDogOnTheRock,
  //     theWomanKicksTheDogBehindTheCurtain,
  //   );
  //   expect(realiser.realise(aggregated).realisation).toBe(
  //     "the woman kicks the dog on the rock and behind the curtain",
  //   );
  // });
});
