import { Feature } from "../../features/Feature.js";
import { Gender } from "../../features/Gender.js";
import { InternalFeature } from "../../features/InternalFeature.js";
import { LexicalFeature } from "../../features/LexicalFeature.js";
import { NumberAgreement } from "../../features/NumberAgreement.js";
import { Person } from "../../features/Person.js";

import { AdjPhraseSpec } from "../../phrasespec/AdjPhraseSpec.js";
import { AdvPhraseSpec } from "../../phrasespec/AdvPhraseSpec.js";
import { NPPhraseSpec } from "../../phrasespec/NPPhraseSpec.js";
import { PPPhraseSpec } from "../../phrasespec/PPPhraseSpec.js";
import { SPhraseSpec } from "../../phrasespec/SPhraseSpec.js";
import { VPPhraseSpec } from "../../phrasespec/VPPhraseSpec.js";

import { CoordinatedPhraseElement } from "../../framework/CoordinatedPhraseElement.js";
import { DocumentCategory } from "../../framework/DocumentCategory.js";
import { DocumentElement } from "../../framework/DocumentElement.js";
import { InflectedWordElement } from "../../framework/InflectedWordElement.js";
import { LexicalCategory } from "../../framework/LexicalCategory.js";
import { NLGElement } from "../../framework/NLGElement.js";
import { PhraseElement } from "../../framework/PhraseElement.js";
import { StringElement } from "../../framework/StringElement.js";
import { WordElement } from "../../framework/WordElement.js";
import { NLGContext } from "../NLGContext.js";
import { createClauseOptions, NLGFactory } from "../NLGFactory.js";
import { InitialisedCategory } from "../../framework/InitialisedCategory.js";

export class EnglishFactory implements NLGFactory {
  private context: NLGContext;

  private static readonly PRONOUNS = [
    "I",
    "you",
    "he",
    "she",
    "it",
    "me",
    "you",
    "him",
    "her",
    "it",
    "myself",
    "yourself",
    "himself",
    "herself",
    "itself",
    "mine",
    "yours",
    "his",
    "hers",
    "its",
    "we",
    "you",
    "they",
    "they",
    "they",
    "us",
    "you",
    "them",
    "them",
    "them",
    "ourselves",
    "yourselves",
    "themselves",
    "themselves",
    "themselves",
    "ours",
    "yours",
    "theirs",
    "theirs",
    "theirs",
    "there",
  ];
  private static readonly FIRST_PRONOUNS = [
    "I",
    "me",
    "myself",
    "we",
    "us",
    "ourselves",
    "mine",
    "my",
    "ours",
    "our",
  ];
  private static readonly SECOND_PRONOUNS = [
    "you",
    "yourself",
    "yourselves",
    "yours",
    "your",
  ];
  private static readonly REFLEXIVE_PRONOUNS = [
    "myself",
    "yourself",
    "himself",
    "herself",
    "itself",
    "ourselves",
    "yourselves",
    "themselves",
  ];
  private static readonly MASCULINE_PRONOUNS = ["he", "him", "himself", "his"];
  private static readonly FEMININE_PRONOUNS = ["she", "her", "herself", "hers"];
  private static readonly POSSESSIVE_PRONOUNS = [
    "mine",
    "ours",
    "yours",
    "his",
    "hers",
    "its",
    "theirs",
    "my",
    "our",
    "your",
    "her",
    "their",
  ];
  private static readonly PLURAL_PRONOUNS = [
    "we",
    "us",
    "ourselves",
    "ours",
    "our",
    "they",
    "them",
    "theirs",
    "their",
  ];
  private static readonly EITHER_NUMBER_PRONOUNS = ["there"];
  private static readonly EXPLETIVE_PRONOUNS = ["there"];
  private static readonly WORD_REGEX = /^\w*$/;

  static withContext(context: NLGContext): EnglishFactory {
    return new EnglishFactory(context);
  }

  private constructor(context: NLGContext) {
    this.context = context;
  }

  createWord(
    word: string | WordElement,
    category: LexicalCategory,
  ): WordElement;
  createWord(word: NLGElement, category: LexicalCategory): NLGElement;
  createWord(word: NLGElement | string, category: LexicalCategory): NLGElement {
    if (word instanceof NLGElement) {
      return word;
    }
    const wordElement = this.context.lexicon.lookupWord(word, category);
    if (EnglishFactory.PRONOUNS.includes(word)) {
      this.setPronounFeatures(wordElement, word);
    }
    return wordElement;
  }

  createInflectedWord(
    word: WordElement | string | NLGElement,
    category: LexicalCategory,
  ): NLGElement {
    if (word instanceof WordElement) {
      return InflectedWordElement.fromWordElement(word, this.context);
    } else if (typeof word === "string") {
      const baseword = this.createWord(word, category);
      if (baseword instanceof WordElement) {
        return InflectedWordElement.fromWordElement(baseword, this.context);
      } else {
        return InflectedWordElement.fromString(word, category, this.context);
      }
    }
    return word;
  }

  private setPronounFeatures(wordElement: NLGElement, word: string) {
    wordElement.category = LexicalCategory.PRONOUN;
    if (EnglishFactory.FIRST_PRONOUNS.includes(word)) {
      wordElement.features[Feature.PERSON] = Person.FIRST;
    } else if (EnglishFactory.SECOND_PRONOUNS.includes(word)) {
      wordElement.features[Feature.PERSON] = Person.SECOND;
      if (word.toLowerCase() === "yourself") {
        wordElement.plural = false;
      } else if (word.toLowerCase() === "yourselves") {
        wordElement.plural = true;
      } else {
        wordElement.features[Feature.NUMBER] = NumberAgreement.BOTH;
      }
    } else {
      wordElement.features[Feature.PERSON] = Person.THIRD;
    }

    wordElement.features[LexicalFeature.REFLEXIVE] =
      EnglishFactory.REFLEXIVE_PRONOUNS.includes(word);

    if (EnglishFactory.MASCULINE_PRONOUNS.includes(word)) {
      wordElement.features[LexicalFeature.GENDER] = Gender.MASCULINE;
    } else if (EnglishFactory.FEMININE_PRONOUNS.includes(word)) {
      wordElement.features[LexicalFeature.GENDER] = Gender.FEMININE;
    } else {
      wordElement.features[LexicalFeature.GENDER] = Gender.NEUTER;
    }

    wordElement.features[Feature.POSSESSIVE] =
      EnglishFactory.POSSESSIVE_PRONOUNS.includes(word);

    if (
      EnglishFactory.PLURAL_PRONOUNS.includes(word) &&
      !EnglishFactory.SECOND_PRONOUNS.includes(word)
    ) {
      wordElement.plural = true;
    } else if (!EnglishFactory.EITHER_NUMBER_PRONOUNS.includes(word)) {
      wordElement.plural = false;
    }

    if (EnglishFactory.EXPLETIVE_PRONOUNS.includes(word)) {
      wordElement.features[InternalFeature.NON_MORPH] = true;
      wordElement.features[LexicalFeature.EXPLETIVE_SUBJECT] = true;
    }
  }

  createPrepositionPhrase(
    preposition: InflectedWordElement | StringElement | NLGElement | string,
    complement?: InflectedWordElement | StringElement | NLGElement | string,
  ): PPPhraseSpec {
    const prepositionalElement = this.createNLGElement(
      preposition,
      LexicalCategory.PREPOSITION,
    );
    const phraseElement = PPPhraseSpec.create(
      prepositionalElement,
      this.context,
    );
    this.setPhraseHead(phraseElement, prepositionalElement);
    if (complement) {
      this.setComplement(phraseElement, complement);
    }
    return phraseElement;
  }

  private setComplement(
    phraseElement: PhraseElement,
    complement: InflectedWordElement | StringElement | NLGElement | string,
  ) {
    const complementElement = this.createNLGElement(
      complement,
      LexicalCategory.ANY /* TODO (later): Complementizer? */,
    );
    phraseElement.addComplement(complementElement);
  }

  createNLGElement(
    element: InflectedWordElement | StringElement | NLGElement | string,
    category: LexicalCategory,
  ): NLGElement {
    if (element instanceof InflectedWordElement) return element.baseWord;
    if (element instanceof StringElement) {
      if (this.stringIsWord(element.realisation, category)) {
        return this.createWord(element.realisation, category);
      } else {
        return element;
      }
    }
    if (element instanceof NLGElement) return element;
    if (this.stringIsWord(element, category)) {
      return this.createWord(element, category);
    }
    return StringElement.fromString(element, this.context);
  }

  private stringIsWord(string: string, category: LexicalCategory): boolean {
    return (
      this.context.lexicon.hasWord(string, category) ||
      EnglishFactory.PRONOUNS.includes(string) ||
      new RegExp(EnglishFactory.WORD_REGEX).test(string)
    );
  }

  createNounPhraseDetNoun(
    determiner: string | NLGElement,
    noun: string | NLGElement,
  ) {
    const determinerElement =
      typeof determiner === "string"
        ? this.createWord(determiner, LexicalCategory.DETERMINER)
        : determiner;
    const nounElement =
      noun instanceof NLGElement
        ? noun
        : this.createNLGElement(noun, LexicalCategory.NOUN);
    const phraseElement = NPPhraseSpec.create(nounElement, this.context);
    this.setPhraseHead(phraseElement, nounElement);
    phraseElement.determiner = determinerElement;
    return phraseElement;
  }

  createNounPhrase(
    noun: string | NLGElement | InflectedWordElement | StringElement,
    specifier?: NPPhraseSpec,
    category: LexicalCategory = LexicalCategory.NOUN,
  ): NPPhraseSpec {
    if (noun instanceof NPPhraseSpec) return noun;
    const nounElement = this.createNLGElement(noun, category);
    const phraseElement = NPPhraseSpec.create(nounElement, this.context);
    this.setPhraseHead(phraseElement, nounElement);
    if (specifier) phraseElement.specifier = specifier;
    return phraseElement;
  }

  private setPhraseHead(
    phraseElement: PhraseElement | undefined,
    headElement: NLGElement | undefined,
  ) {
    if (phraseElement) phraseElement.head = headElement;
    if (headElement) headElement.parent = phraseElement;
  }

  createAdjectivePhrase(
    adjective: string | NLGElement | StringElement | InflectedWordElement,
  ): AdjPhraseSpec {
    const adjectiveElement = this.createNLGElement(
      adjective,
      LexicalCategory.ADJECTIVE,
    );
    const phraseElement = AdjPhraseSpec.withContext(
      adjectiveElement,
      this.context,
    );
    this.setPhraseHead(phraseElement, adjectiveElement);
    return phraseElement;
  }

  createVerbPhrase(): VPPhraseSpec;
  createVerbPhrase(verb: NLGElement | string): VPPhraseSpec;
  createVerbPhrase(verb?: NLGElement | string): VPPhraseSpec {
    const phraseElement =
      verb === undefined
        ? VPPhraseSpec.create(this.context)
        : VPPhraseSpec.withVerb(verb, this.context);
    // phraseElement.verb = verb; // Conversion note: duplicate assignment, removed this line
    this.setPhraseHead(phraseElement, phraseElement.verb);
    return phraseElement;
  }
  // Conversion Note: Removed some optional parameters across the file since they (in the Java source) return null, which is not desirable in an API
  // overall the source API seems like to create empty object with the expectation that the user of of the API will set the properties
  // we try move away from this pattern in the TypeScript API

  createAdverbPhrase(adverb: string | NLGElement): AdvPhraseSpec {
    const adverbElement =
      adverb instanceof NLGElement
        ? adverb
        : this.createNLGElement(adverb, LexicalCategory.ADVERB);
    adverbElement.category = LexicalCategory.ADVERB;
    const phraseElement = AdvPhraseSpec.create(adverbElement, this.context);
    this.setPhraseHead(phraseElement, adverbElement);
    return phraseElement;
  }

  createClauseVP(
    verbPhrase: NLGElement,
    subject?: NLGElement | string,
    directObject?: NLGElement | string,
  ): SPhraseSpec {
    const phraseElement = SPhraseSpec.withVerbPhrase(verbPhrase, this.context);
    if (subject) phraseElement.setSubject(subject);
    if (directObject) phraseElement.setObject(directObject);
    return phraseElement;
  }

  createClause(options: createClauseOptions): SPhraseSpec;
  createClause(
    subject: NLGElement | string,
    verb: NLGElement | string,
    directObject?: NLGElement | string,
  ): SPhraseSpec;
  createClause(
    subject: NLGElement | string | createClauseOptions,
    verb?: NLGElement | string,
    directObject?: NLGElement | string,
  ): SPhraseSpec {
    let phraseElement;
    if (typeof subject === "object" && !(subject instanceof NLGElement)) {
      if ("verbPhrase" in subject) {
        phraseElement = SPhraseSpec.withVerbPhrase(
          subject.verbPhrase,
          this.context,
        );
      } else if ("verb" in subject) {
        phraseElement = SPhraseSpec.withVerb(subject.verb, this.context);
      } else {
        phraseElement = SPhraseSpec.create(this.context);
      }
      if (subject.subject) phraseElement.setSubject(subject.subject);
      if (subject.directObject) phraseElement.setObject(subject.directObject);
      if (subject.complement) phraseElement.setComplement(subject.complement);
      if (subject.indirectObject)
        phraseElement.setIndirectObject(subject.indirectObject);
      if (subject.postModifier)
        phraseElement.setPostModifier(subject.postModifier);
      if (subject.frontModifier)
        phraseElement.setFrontModifier(subject.frontModifier);
      return phraseElement;
    } else if (verb instanceof PhraseElement) {
      phraseElement = SPhraseSpec.withVerbPhrase(verb, this.context);
    } else {
      phraseElement = SPhraseSpec.withVerb(verb ?? "", this.context); // verb should never be undefined, given the two allowed signatures
    }

    phraseElement.setSubject(subject);
    if (directObject) phraseElement.setObject(directObject);
    return phraseElement;
  }

  createStringElement(text: string): StringElement {
    return StringElement.fromString(text, this.context);
  }
  createCoordinatedPhrase(): CoordinatedPhraseElement;
  createCoordinatedPhrase(
    coordinate1: NLGElement | string,
    coordinate2: NLGElement | string,
  ): CoordinatedPhraseElement;
  createCoordinatedPhrase(
    coordinate1?: NLGElement | string,
    coordinate2?: NLGElement | string,
  ): CoordinatedPhraseElement {
    if (coordinate1 === undefined || coordinate2 === undefined) {
      return CoordinatedPhraseElement.create(
        InitialisedCategory.INITIALISED_COORDINATED_PHRASE,
        this.context,
      );
    }
    return CoordinatedPhraseElement.withCoordinates(
      InitialisedCategory.INITIALISED_COORDINATED_PHRASE,
      coordinate1,
      coordinate2,
      this.context,
    );
  }

  createDocument(title?: string, components?: NLGElement[]): DocumentElement {
    const document = DocumentElement.fromCategory(
      DocumentCategory.DOCUMENT,
      this.context,
      title,
    );
    if (components !== undefined) document.addComponents(components);
    return document;
  }

  createList(components?: NLGElement[]): DocumentElement {
    const list = DocumentElement.fromCategory(
      DocumentCategory.LIST,
      this.context,
    );
    if (components !== undefined) list.addComponents(components);
    return list;
  }

  createEnumeratedList(components?: NLGElement[]): DocumentElement {
    const list = DocumentElement.fromCategory(
      DocumentCategory.ENUMERATED_LIST,
      this.context,
    );
    if (components !== undefined) list.addComponents(components);
    return list;
  }

  createListItem(components: NLGElement): DocumentElement {
    const listItem = DocumentElement.fromCategory(
      DocumentCategory.LIST_ITEM,
      this.context,
    );
    if (components !== undefined) listItem.addComponent(components);
    return listItem;
  }

  createParagraph(components?: NLGElement[]): DocumentElement {
    const paragraph = DocumentElement.fromCategory(
      DocumentCategory.PARAGRAPH,
      this.context,
    );
    if (components !== undefined) paragraph.addComponents(components);
    return paragraph;
  }

  createSection(title?: string, components?: NLGElement[]): DocumentElement {
    const section = DocumentElement.fromCategory(
      DocumentCategory.SECTION,
      this.context,
      title,
    );
    if (components !== undefined) section.addComponents(components);
    return section;
  }

  createSentence(
    components?: NLGElement[] | NLGElement | string,
  ): DocumentElement {
    if (typeof components === "string") {
      return this.createSentenceCanned(components);
    }
    const sentence = DocumentElement.fromCategory(
      DocumentCategory.SENTENCE,
      this.context,
    );
    if (components !== undefined)
      sentence.addComponents(
        components instanceof Array ? components : [components],
      );
    return sentence;
  }

  createSentenceCanned(text: string): DocumentElement {
    const sentence = DocumentElement.fromCategory(
      DocumentCategory.SENTENCE,
      this.context,
    );
    sentence.addComponent(this.createStringElement(text));
    return sentence;
  }

  createSentenceSVC(
    subject: string,
    verb: string,
    complement?: string,
  ): DocumentElement {
    const sentence = DocumentElement.fromCategory(
      DocumentCategory.SENTENCE,
      this.context,
    );
    sentence.addComponent(this.createClause(subject, verb, complement));
    return sentence;
  }
}
