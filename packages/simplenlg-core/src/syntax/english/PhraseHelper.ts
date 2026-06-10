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
import { InternalFeature } from "../../features/InternalFeature.js";
import { LexicalFeature } from "../../features/LexicalFeature.js";
import { NLGElement } from "../../framework/NLGElement.js";
import { InflectedWordElement } from "../../framework/InflectedWordElement.js";
import { LexicalCategory } from "../../framework/LexicalCategory.js";
import { ListElement } from "../../framework/ListElement.js";
import { PhraseCategory } from "../../framework/PhraseCategory.js";
import { PhraseElement } from "../../framework/PhraseElement.js";
import { copyField } from "../../utils.js";
import { SyntaxProcessor } from "./SyntaxProcessor.js";

export class PhraseHelper {
  public static realise(
    parent: SyntaxProcessor,
    phrase: PhraseElement,
  ): NLGElement | undefined {
    if (!phrase) return undefined;

    // Conversion Note: Added category inheritance to the realisedElement
    const realisedElement = ListElement.create(phrase.category, parent.context);

    this.realiseList(
      parent,
      realisedElement,
      phrase.getPreModifiers(),
      DiscourseFunction.PRE_MODIFIER,
    );
    this.realiseHead(parent, phrase, realisedElement);
    this.realiseComplements(parent, phrase, realisedElement);
    this.realiseList(
      parent,
      realisedElement,
      phrase.getPostModifiers(),
      DiscourseFunction.POST_MODIFIER,
    );

    return realisedElement;
  }

  private static realiseComplements(
    parent: SyntaxProcessor,
    phrase: PhraseElement,
    realisedElement: ListElement,
  ): void {
    let firstProcessed = false;

    for (const complement of phrase.features[InternalFeature.COMPLEMENTS] ??
      []) {
      const currentElement = parent.realise(complement);
      if (!currentElement) continue;

      currentElement.features[InternalFeature.DISCOURSE_FUNCTION] =
        DiscourseFunction.COMPLEMENT;

      if (firstProcessed) {
        const andWord = InflectedWordElement.fromString(
          "and",
          LexicalCategory.CONJUNCTION,
          parent.context,
        );
        realisedElement.addComponent(andWord);
      } else {
        firstProcessed = true;
      }
      realisedElement.addComponent(currentElement);
    }
  }

  private static realiseHead(
    parent: SyntaxProcessor,
    phrase: PhraseElement,
    realisedElement: ListElement,
  ): void {
    const head = phrase.head;
    if (!head) return;

    copyField(phrase.features, head.features, Feature.IS_COMPARATIVE);
    copyField(phrase.features, head.features, Feature.IS_SUPERLATIVE);

    const realisedHead = parent.realise(head);
    if (realisedHead) {
      realisedHead.features[InternalFeature.DISCOURSE_FUNCTION] =
        DiscourseFunction.HEAD;
      realisedElement.addComponent(realisedHead);
    }
  }

  public static realiseList(
    parent: SyntaxProcessor,
    realisedElement: ListElement,
    elementList: NLGElement[],
    func: DiscourseFunction,
  ): void {
    // Conversion Note: Added category inheritance to the realisedList
    const realisedList = ListElement.create(
      realisedElement.category,
      parent.context,
    );

    for (const element of elementList) {
      const currentElement = parent.realise(element);
      if (!currentElement) continue;

      currentElement.features[InternalFeature.DISCOURSE_FUNCTION] = func;

      if (element.features[Feature.APPOSITIVE]) {
        currentElement.features[Feature.APPOSITIVE] = true;
      }

      realisedList.addComponent(currentElement);
    }

    if (realisedList.getChildren().length > 0) {
      realisedElement.addComponent(realisedList);
    }
  }

  public static isExpletiveSubject(phrase: PhraseElement): boolean {
    const subjects = phrase.features[InternalFeature.SUBJECTS];
    if (!subjects?.length || subjects.length !== 1 || subjects[0] === undefined)
      return false;

    const subjectNP = subjects[0];
    if (subjectNP.isA(PhraseCategory.NOUN_PHRASE)) {
      return subjectNP.features[LexicalFeature.EXPLETIVE_SUBJECT] ?? false;
    }
    if (subjectNP.isA(PhraseCategory.CANNED_TEXT)) {
      return subjectNP.realisation.toLowerCase() === "there";
    }

    return false;
  }
}
