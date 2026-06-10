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

/**
 * This class defines a adjective phrase. It is essentially
 * a wrapper around the PhraseElement class, with methods
 * for setting common constituents such as preModifier.
 * For example, the setAdjective method in this class sets
 * the head of the element to be the specified adjective
 *
 * Methods are provided for setting and getting the following constituents:
 * - PreModifier   (eg, "very")
 * - Adjective     (eg, "happy")
 *
 * NOTE: AdjPhraseSpec do not usually have (user-set) features
 */
export class AdjPhraseSpec extends PhraseElement {
  override defaultValues: {
    [Feature.ELIDED]: boolean;
    [InternalFeature.HEAD]: NLGElement;
  };

  override readonly features: typeof this.defaultValues &
    Partial<BaseFeatureSet>;

  public static withContext(
    adjective: NLGElement,
    context: NLGContext,
  ): AdjPhraseSpec {
    const phrase = new AdjPhraseSpec(adjective, context);
    return phrase;
  }

  private constructor(adjective: NLGElement, context: NLGContext) {
    super(PhraseCategory.ADJECTIVE_PHRASE, context);

    // set default values
    this.defaultValues = {
      [Feature.ELIDED]: false,
      [InternalFeature.HEAD]: context.getEmpty("Temporary Head"), // read after setting it with setVerbPhrase
    };

    this.features = { ...this.defaultValues };
    this.adjective = adjective;
  }

  /**
   * Sets the adjective (head) of this phrase.
   *
   * @param adjective - Sets the head adjective for this AdjPhraseSpec
   */
  public set adjective(adjective: NLGElement | string) {
    if (adjective instanceof NLGElement) {
      this.head = adjective;
    } else {
      // create adjective as word
      const adjectiveElement = this.context.factory.createWord(
        adjective,
        LexicalCategory.ADJECTIVE,
      );

      // set head of phrase to adjectiveElement
      this.head = adjectiveElement;
    }
  }

  /**
   * @returns adjective (head) of phrase
   */
  public get adjective(): NLGElement | undefined {
    return this.head;
  }
}
