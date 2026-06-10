import { CoordinatedPhraseElement } from "../framework/CoordinatedPhraseElement.js";
import { DocumentElement } from "../framework/DocumentElement.js";
import { InflectedWordElement } from "../framework/InflectedWordElement.js";
import { LexicalCategory } from "../framework/LexicalCategory.js";
import { NLGElement } from "../framework/NLGElement.js";
import { StringElement } from "../framework/StringElement.js";
import { WordElement } from "../framework/WordElement.js";
import { AdjPhraseSpec } from "../phrasespec/AdjPhraseSpec.js";
import { AdvPhraseSpec } from "../phrasespec/AdvPhraseSpec.js";
import { NPPhraseSpec } from "../phrasespec/NPPhraseSpec.js";
import { PPPhraseSpec } from "../phrasespec/PPPhraseSpec.js";
import { SPhraseSpec } from "../phrasespec/SPhraseSpec.js";
import { VPPhraseSpec } from "../phrasespec/VPPhraseSpec.js";

export type createInflectedWordOptions = {
  word: WordElement | string | NLGElement;
  category: LexicalCategory;
};

export type createWordOptions = {
  word: WordElement | string | NLGElement;
  category: LexicalCategory;
};

export type createPrepositionPhraseOptions = {
  preposition: InflectedWordElement | StringElement | NLGElement | string;
  complement?: InflectedWordElement | StringElement | NLGElement | string;
};

export type createNLGElementOptions = {
  element: InflectedWordElement | StringElement | NLGElement | string;
  category: LexicalCategory;
};

export type createClauseOptions = (
  | {
      verb: NLGElement | string;
      verbPhrase?: never;
    }
  | {
      verb?: never;
      verbPhrase: NLGElement;
    }
  | object
) & {
  subject?: NLGElement | string | undefined;
  directObject?: NLGElement | string | undefined;
  indirectObject?: NLGElement | string | undefined;
  complement?: NLGElement | string | undefined;
  postModifier?: NLGElement | string | undefined;
  frontModifier?: NLGElement | string | undefined;
};

export type createStringElementOptions = {
  text: string;
};

export type createNounPhraseOptions = {
  noun: string | NLGElement | InflectedWordElement | StringElement;
  specifier?: NPPhraseSpec;
};

export type createAdjectivePhraseOptions = {
  adjective: string | NLGElement | StringElement | InflectedWordElement;
};

export type createVerbPhraseOptions = {
  verb: NLGElement | string;
};

export type createAdverbPhraseOptions = {
  adverb: NLGElement | string;
};

export type createCoordinatedPhraseOptions = {
  coordinates: [NLGElement | string, ...(NLGElement[] | string[])];
  conjunction?: NLGElement | string;
};

export type createDocumentOptions = {
  title?: string;
  components?: NLGElement[];
};

export type createListOptions = {
  components?: NLGElement[];
};

export type createEnumeratedListOptions = {
  components?: NLGElement[];
};

export type createListItemOptions = {
  components: NLGElement;
};

export type createParagraphOptions = {
  components?: NLGElement[];
};

export type createSectionOptions = {
  title?: string;
  components?: NLGElement[];
};

export type createSentenceOptions = {
  components?: NLGElement[];
};

export type createSentenceCannedOptions = {
  text: string;
};

export type createSentenceSVCOptions = {
  subject: string;
  verb: string;
  complement: string;
};

export interface NLGFactory {
  createWord(
    word: string | WordElement,
    category: LexicalCategory,
  ): WordElement;
  createWord(word: NLGElement, category: LexicalCategory): NLGElement;

  createInflectedWord(
    word: WordElement | string | NLGElement,
    category: LexicalCategory,
  ): NLGElement;

  createPrepositionPhrase(
    preposition: InflectedWordElement | StringElement | NLGElement | string,
    complement?: InflectedWordElement | StringElement | NLGElement | string,
  ): PPPhraseSpec;

  createNLGElement(
    element: InflectedWordElement | StringElement | NLGElement | string,
    category: LexicalCategory,
  ): NLGElement;

  createNounPhraseDetNoun(
    determiner: string | NLGElement,
    noun: string | NLGElement,
  ): NPPhraseSpec;

  createNounPhrase(
    noun: string | NLGElement | InflectedWordElement | StringElement,
    specifier?: NPPhraseSpec,
    category?: LexicalCategory,
  ): NPPhraseSpec;

  createAdjectivePhrase(
    adjective: string | NLGElement | StringElement | InflectedWordElement,
  ): AdjPhraseSpec;

  createVerbPhrase(): VPPhraseSpec;
  createVerbPhrase(verb: NLGElement | string): VPPhraseSpec;

  createAdverbPhrase(adverb: NLGElement | string): AdvPhraseSpec;

  createClauseVP(
    verbPhrase: NLGElement,
    subject?: NLGElement | string,
    directObject?: NLGElement | string,
  ): SPhraseSpec;

  createClause(
    subject: NLGElement | string,
    verb: NLGElement | string,
    directObject?: NLGElement | string,
  ): SPhraseSpec;

  createClause(options: createClauseOptions): SPhraseSpec;

  createStringElement(text: string): StringElement;

  createCoordinatedPhrase(): CoordinatedPhraseElement;
  createCoordinatedPhrase(
    coordinate1: NLGElement | string,
    coordinate2: NLGElement | string,
  ): CoordinatedPhraseElement;
  createCoordinatedPhrase(
    coordinate1?: NLGElement | string,
    coordinate2?: NLGElement | string,
  ): CoordinatedPhraseElement;

  createDocument(title?: string, components?: NLGElement[]): DocumentElement;

  createList(components?: NLGElement[]): DocumentElement;

  createEnumeratedList(components?: NLGElement[]): DocumentElement;

  createListItem(components: NLGElement): DocumentElement;

  createParagraph(components?: NLGElement[]): DocumentElement;

  createSection(title?: string, components?: NLGElement[]): DocumentElement;

  createSentence(
    components?: NLGElement[] | NLGElement | string,
  ): DocumentElement;
  createSentenceCanned(text: string): DocumentElement;
  createSentenceSVC(
    subject: string,
    verb: string,
    complement: string,
  ): DocumentElement;
}
