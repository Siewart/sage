import {
  defaultEnglishContext,
  NLGContext,
} from "../src/factory/NLGContext.js";
import { Realiser } from "../src/realiser/english/Realiser.js";

export default (
  contextOverwrite?: NLGContext,
  realiserOverwrite?: Realiser,
) => {
  const context = contextOverwrite ?? defaultEnglishContext;
  const realiser = realiserOverwrite ?? Realiser.create(defaultEnglishContext);
  const set = {
    context: defaultEnglishContext,
    realiser: realiser,
    nounPhrase: {
      theDog: context.factory.createNounPhraseDetNoun("the", "dog"),
      theGirl: context.factory.createNounPhraseDetNoun("the", "girl"),
      theBoy: context.factory.createNounPhraseDetNoun("the", "boy"),
      theWoman: context.factory.createNounPhraseDetNoun("the", "woman"),
      theMan: context.factory.createNounPhraseDetNoun("the", "man"),

      theRock: context.factory.createNounPhraseDetNoun("the", "rock"),
      theCurtain: context.factory.createNounPhraseDetNoun("the", "curtain"),
      theRoom: context.factory.createNounPhraseDetNoun("the", "room"),
      theTable: context.factory.createNounPhraseDetNoun("the", "table"),

      proTest: context.factory.createNounPhraseDetNoun("the", "singer"),
      proTest2: context.factory.createNounPhraseDetNoun("some", "person"),
    },
    adj: {
      beautiful: context.factory.createAdjectivePhrase("beautiful"),
      stunning: context.factory.createAdjectivePhrase("stunning"),
      salacious: context.factory.createAdjectivePhrase("salacious"),
    },
    prepositionPhrase: {
      onTheRock: context.factory.createPrepositionPhrase("on"),
      behindTheCurtain: context.factory.createPrepositionPhrase("behind"),
      inTheRoom: context.factory.createPrepositionPhrase("in"),
      underTheTable: context.factory.createPrepositionPhrase("under"),
    },
    verbPhrase: {
      kick: context.factory.createVerbPhrase("kick"),
      kiss: context.factory.createVerbPhrase("kiss"),
      walk: context.factory.createVerbPhrase("walk"),
      talk: context.factory.createVerbPhrase("talk"),
      getUp: context.factory.createVerbPhrase("get up"),
      fallDown: context.factory.createVerbPhrase("fall down"),
      give: context.factory.createVerbPhrase("give"),
      say: context.factory.createVerbPhrase("say"),
    },
  } as const;
  set.prepositionPhrase.onTheRock.addComplement(set.nounPhrase.theRock);
  set.prepositionPhrase.behindTheCurtain.addComplement(
    set.nounPhrase.theCurtain,
  );
  set.prepositionPhrase.inTheRoom.addComplement(set.nounPhrase.theRoom);
  set.prepositionPhrase.underTheTable.addComplement(set.nounPhrase.theTable);

  return set;
};
