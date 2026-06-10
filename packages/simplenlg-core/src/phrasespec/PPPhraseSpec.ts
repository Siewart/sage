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

import { NLGContext } from "../factory/NLGContext.js";
import { DiscourseFunction } from "../features/DiscourseFunction.js";
import { Feature } from "../features/Feature.js";
import { InternalFeature } from "../features/InternalFeature.js";
import { NLGElement, BaseFeatureSet } from "../framework/NLGElement.js";
import { LexicalCategory } from "../framework/LexicalCategory.js";
import { PhraseCategory } from "../framework/PhraseCategory.js";
import { PhraseElement } from "../framework/PhraseElement.js";

export class PPPhraseSpec extends PhraseElement {
  override defaultValues: {
    [Feature.ELIDED]: boolean;
    [InternalFeature.HEAD]: NLGElement;
  };

  override readonly features: typeof this.defaultValues &
    Partial<BaseFeatureSet>;

  public static create(
    preposition: NLGElement,
    context: NLGContext,
  ): PPPhraseSpec {
    const phrase = new PPPhraseSpec(preposition, context);
    return phrase;
  }

  private constructor(preposition: NLGElement, context: NLGContext) {
    super(PhraseCategory.PREPOSITIONAL_PHRASE, context);
    // set default values
    this.defaultValues = {
      [Feature.ELIDED]: false,
      [InternalFeature.HEAD]: context.getEmpty("Temporary Head"), // read after setting it
    };

    this.features = { ...this.defaultValues };
    this.preposition = preposition; // this sets the head
  }

  /**
   * Sets the preposition (head) of a prepositional phrase.
   *
   * @param preposition - Sets the preposition for this PPPhraseSpec
   */
  public set preposition(preposition: NLGElement | string) {
    if (preposition instanceof NLGElement) {
      this.head = preposition;
    } else {
      // create preposition as word
      const prepositionalElement = this.context.factory.createWord(
        preposition,
        LexicalCategory.PREPOSITION,
      );

      // set head of phrase to prepositionalElement
      this.head = prepositionalElement;
    }
  }

  /**
   * @returns preposition (head) of prepositional phrase
   */
  public get preposition(): NLGElement | undefined {
    return this.head;
  }

  /**
   * Sets the object of a Prepositional Phrase.
   *
   * @param object - Sets the object for this PPPhraseSpec
   */
  public setObject(object: NLGElement | string): void {
    const objectPhrase = this.context.factory.createNounPhrase(object);
    objectPhrase.features[InternalFeature.DISCOURSE_FUNCTION] =
      DiscourseFunction.OBJECT;

    this.addComplement(objectPhrase); // TODO (later): we dont remove the old one, is that correct? The current implemenation is in line with the Java code
  }

  /**
   * @returns object of PP (assume only one)
   */
  public getObject(): NLGElement | undefined {
    const complements = this.features[InternalFeature.COMPLEMENTS];
    for (const complement of complements ?? []) {
      if (
        complement.features[InternalFeature.DISCOURSE_FUNCTION] ===
        DiscourseFunction.OBJECT
      ) {
        return complement;
      }
    }
    return undefined;
  }
}
