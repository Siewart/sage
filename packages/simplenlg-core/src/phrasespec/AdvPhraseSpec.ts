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
import { Feature } from "../features/Feature.js";
import { InternalFeature } from "../features/InternalFeature.js";
import { NLGElement, BaseFeatureSet } from "../framework/NLGElement.js";
import { LexicalCategory } from "../framework/LexicalCategory.js";
import { PhraseCategory } from "../framework/PhraseCategory.js";
import { PhraseElement } from "../framework/PhraseElement.js";

export class AdvPhraseSpec extends PhraseElement {
  override defaultValues: {
    [Feature.ELIDED]: boolean;
    [InternalFeature.HEAD]: NLGElement;
  };

  override readonly features: typeof this.defaultValues &
    Partial<BaseFeatureSet>;

  public static create(adverb: NLGElement, context: NLGContext): AdvPhraseSpec {
    const phrase = new AdvPhraseSpec(adverb, context);
    return phrase;
  }

  private constructor(adverb: NLGElement, context: NLGContext) {
    super(PhraseCategory.ADVERB_PHRASE, context);

    // set default values
    this.defaultValues = {
      [Feature.ELIDED]: false,
      [InternalFeature.HEAD]: context.getEmpty("Unset Head"), // read after setting it
    };

    this.features = { ...this.defaultValues };
    this.adverb = adverb; // this sets the head
    if (this.head) this.defaultValues[InternalFeature.HEAD] = this.head;
  }

  /**
   * Sets the adverb (head) of this phrase.
   *
   * @param adverb - Sets the head adverb for this AdvPhraseSpec
   */
  public set adverb(adverb: NLGElement | string) {
    if (adverb instanceof NLGElement) {
      this.head = adverb;
    } else {
      // create adverb as word
      const adverbElement = this.context.factory.createWord(
        adverb,
        LexicalCategory.ADVERB,
      );

      // set head of phrase to adverbElement
      this.head = adverbElement;
    }
  }

  /**
   * @returns adverb (head) of phrase
   */
  public get adverb(): NLGElement | undefined {
    return this.head;
  }
}
