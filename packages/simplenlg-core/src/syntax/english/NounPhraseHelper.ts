/*
 * The contents of this file are subject to the Mozilla Public License
 * Version 2.0 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * https://www.mozilla.org/en-US/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS"
 * basis, WITHOUT WARRANTY OF ANY KIND, either express or implied. See the
 * License for the specific language governing rights and limitations
 * under the License.
 *
 * The Original Code is "Simplenlg".
 *
 * The Initial Developer of the Original Code is Ehud Reiter, Albert Gatt and Dave Westwater.
 * Portions created by Ehud Reiter, Albert Gatt and Dave Westwater are Copyright (C) 2010-11 The University of Aberdeen. All Rights Reserved.
 *
 * Contributor(s): Ehud Reiter, Albert Gatt, Dave Westwater, Roman Kutlak, Margaret Mitchell, and Saad Mahamood.
 *
 * TypeScript conversion: Siewart van Wingerden (University of Twente)
 */

import { DiscourseFunction } from "../../features/DiscourseFunction.js";
import { Feature } from "../../features/Feature.js";
import { Gender } from "../../features/Gender.js";
import { InternalFeature } from "../../features/InternalFeature.js";
import { LexicalFeature } from "../../features/LexicalFeature.js";
import { Person } from "../../features/Person.js";
import { NLGElement } from "../../framework/NLGElement.js";
import { InflectedWordElement } from "../../framework/InflectedWordElement.js";
import { LexicalCategory } from "../../framework/LexicalCategory.js";
import { ListElement } from "../../framework/ListElement.js";
import { PhraseCategory } from "../../framework/PhraseCategory.js";
import { PhraseElement } from "../../framework/PhraseElement.js";
import { WordElement } from "../../framework/WordElement.js";
import { copyField } from "../../utils.js";
import { SyntaxProcessor } from "./SyntaxProcessor.js";
import { PhraseHelper } from "./PhraseHelper.js";

export abstract class NounPhraseHelper {
  private static readonly QUALITATIVE_POSITION = 1;
  private static readonly COLOUR_POSITION = 2;
  private static readonly CLASSIFYING_POSITION = 3;
  private static readonly NOUN_POSITION = 4;

  public static realise(
    parent: SyntaxProcessor,
    phrase: PhraseElement,
  ): NLGElement | undefined {
    if (!phrase || phrase.features[Feature.ELIDED]) {
      return undefined;
    }

    const realisedElement = ListElement.create(
      PhraseCategory.NOUN_PHRASE,
      parent.context,
    );

    if (phrase.features[Feature.PRONOMINAL]) {
      realisedElement.addComponent(this.createPronoun(parent, phrase));
    } else {
      this.realiseSpecifier(phrase, parent, realisedElement);
      this.realisePreModifiers(phrase, parent, realisedElement);
      this.realiseHeadNoun(phrase, parent, realisedElement);
      PhraseHelper.realiseList(
        parent,
        realisedElement,
        phrase.features[InternalFeature.COMPLEMENTS] ?? [],
        DiscourseFunction.COMPLEMENT,
      );
      PhraseHelper.realiseList(
        parent,
        realisedElement,
        phrase.getPostModifiers(),
        DiscourseFunction.POST_MODIFIER,
      );
    }

    return realisedElement;
  }

  private static realiseHeadNoun(
    phrase: PhraseElement,
    parent: SyntaxProcessor,
    realisedElement: ListElement,
  ): void {
    const headElement = phrase.head;
    if (!headElement) return;

    copyField(phrase.features, headElement.features, Feature.ELIDED);
    copyField(phrase.features, headElement.features, LexicalFeature.GENDER);
    copyField(phrase.features, headElement.features, InternalFeature.ACRONYM);
    copyField(phrase.features, headElement.features, Feature.NUMBER);
    copyField(phrase.features, headElement.features, Feature.PERSON);
    copyField(phrase.features, headElement.features, Feature.POSSESSIVE);
    copyField(phrase.features, headElement.features, Feature.PASSIVE);

    const currentElement = parent.realise(headElement);
    if (currentElement) {
      currentElement.features[InternalFeature.DISCOURSE_FUNCTION] =
        DiscourseFunction.SUBJECT;
      realisedElement.addComponent(currentElement);
    }
  }

  private static realisePreModifiers(
    phrase: PhraseElement,
    parent: SyntaxProcessor,
    realisedElement: ListElement,
  ): void {
    let preModifiers = phrase.getPreModifiers();
    if (phrase.features[Feature.ADJECTIVE_ORDERING]) {
      preModifiers = this.sortNPPreModifiers(preModifiers);
    }
    PhraseHelper.realiseList(
      parent,
      realisedElement,
      preModifiers,
      DiscourseFunction.PRE_MODIFIER,
    );
  }

  private static realiseSpecifier(
    phrase: PhraseElement,
    parent: SyntaxProcessor,
    realisedElement: ListElement,
  ): void {
    const specifierElement = phrase.features[InternalFeature.SPECIFIER];

    if (
      !specifierElement ||
      phrase.features[InternalFeature.RAISED] ||
      phrase.features[Feature.ELIDED]
    ) {
      return;
    }

    if (
      !specifierElement.isA(LexicalCategory.PRONOUN) &&
      specifierElement.category !== PhraseCategory.NOUN_PHRASE
    ) {
      copyField(phrase.features, specifierElement.features, Feature.NUMBER);
    }

    const currentElement = parent.realise(specifierElement);
    if (currentElement) {
      currentElement.features[InternalFeature.DISCOURSE_FUNCTION] =
        DiscourseFunction.SPECIFIER;
      realisedElement.addComponent(currentElement);
    }
  }

  private static sortNPPreModifiers(
    originalModifiers: NLGElement[],
  ): NLGElement[] {
    if (originalModifiers.length <= 1) {
      return originalModifiers;
    }

    const orderedModifiers = [...originalModifiers];

    orderedModifiers.sort((a, b) => this.getMaxPos(a) - this.getMinPos(b));

    return orderedModifiers;
  }

  private static getMinPos(modifier: NLGElement): number {
    if (
      modifier.isA(LexicalCategory.NOUN) ||
      modifier.isA(PhraseCategory.NOUN_PHRASE)
    ) {
      return this.NOUN_POSITION;
    }

    if (
      modifier.isA(LexicalCategory.ADJECTIVE) ||
      modifier.isA(PhraseCategory.ADJECTIVE_PHRASE)
    ) {
      const adjective = this.getHeadWordElement(modifier);
      if (!adjective) return this.QUALITATIVE_POSITION;

      if (adjective.features[LexicalFeature.QUALITATIVE]) {
        return this.QUALITATIVE_POSITION;
      }
      if (adjective.features[LexicalFeature.COLOUR]) {
        return this.COLOUR_POSITION;
      }
      if (adjective.features[LexicalFeature.CLASSIFYING]) {
        return this.CLASSIFYING_POSITION;
      }
    }

    return this.QUALITATIVE_POSITION;
  }

  private static getMaxPos(modifier: NLGElement): number {
    if (
      modifier.isA(LexicalCategory.ADJECTIVE) ||
      modifier.isA(PhraseCategory.ADJECTIVE_PHRASE)
    ) {
      const adjective = this.getHeadWordElement(modifier);
      if (!adjective) return this.CLASSIFYING_POSITION;

      if (adjective.features[LexicalFeature.CLASSIFYING]) {
        return this.CLASSIFYING_POSITION;
      }
      if (adjective.features[LexicalFeature.COLOUR]) {
        return this.COLOUR_POSITION;
      }
      if (adjective.features[LexicalFeature.QUALITATIVE]) {
        return this.QUALITATIVE_POSITION;
      }
      return this.CLASSIFYING_POSITION;
    }

    return this.NOUN_POSITION;
  }

  private static getHeadWordElement(
    element: NLGElement,
  ): WordElement | undefined {
    if (element instanceof WordElement) {
      return element;
    }
    if (element instanceof InflectedWordElement) {
      return element.baseWord;
    }
    if (element instanceof PhraseElement && element.head) {
      return this.getHeadWordElement(element.head);
    }
    return undefined;
  }

  private static createPronoun(
    parent: SyntaxProcessor,
    phrase: PhraseElement,
  ): NLGElement {
    let pronoun = "it";
    const personValue = phrase.features[Feature.PERSON];

    if (personValue === Person.FIRST) {
      pronoun = "I";
    } else if (personValue === Person.SECOND) {
      pronoun = "you";
    } else {
      const genderValue = phrase.features[LexicalFeature.GENDER];
      if (genderValue === Gender.FEMININE) {
        pronoun = "she";
      } else if (genderValue === Gender.MASCULINE) {
        pronoun = "he";
      }
    }

    const proElement = parent.context.factory.createWord(
      pronoun,
      LexicalCategory.PRONOUN,
    );
    let element: NLGElement;

    if (proElement instanceof WordElement) {
      element = InflectedWordElement.fromWordElement(
        proElement,
        parent.context,
      );

      copyField(proElement.features, element.features, LexicalFeature.GENDER);
      copyField(proElement.features, element.features, Feature.PERSON);
    } else {
      element = proElement;
    }

    element.features[InternalFeature.DISCOURSE_FUNCTION] =
      DiscourseFunction.SPECIFIER;
    copyField(phrase.features, element.features, Feature.POSSESSIVE);
    copyField(phrase.features, element.features, Feature.NUMBER);

    copyField(
      phrase.features,
      element.features,
      InternalFeature.DISCOURSE_FUNCTION,
      false,
    );

    return element;
  }
}
