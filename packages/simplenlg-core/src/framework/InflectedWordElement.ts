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

import { Feature } from "../features/Feature.js";
import { InternalFeature } from "../features/InternalFeature.js";
import { LexicalFeature } from "../features/LexicalFeature.js";
import { NumberAgreement } from "../features/NumberAgreement.js";
import { Person } from "../features/Person.js";
import { Tense } from "../features/Tense.js";
import { NLGContext } from "../factory/NLGContext.js";
import { LexicalCategory } from "./LexicalCategory.js";
import { BaseFeatureSet, NLGElement } from "./NLGElement.js";
import { WordElement } from "./WordElement.js";
import { cloneInto } from "../utils.js";

export class InflectedWordElement extends NLGElement {
  override defaultValues: {
    [LexicalFeature.BASE_FORM]: string;
    [InternalFeature.BASE_WORD]: WordElement;
    [Feature.PERSON]: Person;
    [Feature.TENSE]: Tense;
    [Feature.NUMBER]: NumberAgreement;
  };

  readonly features: typeof this.defaultValues & Partial<BaseFeatureSet>;

  override resetFeatures(): void {
    cloneInto(this.defaultValues, this.features, true);
  }

  static fromString(
    word: string,
    category: LexicalCategory,
    context: NLGContext,
  ): InflectedWordElement {
    const element = new InflectedWordElement(word, category, context);
    return element;
  }

  static fromWordElement(
    word: WordElement,
    context: NLGContext,
  ): InflectedWordElement {
    const element = new InflectedWordElement(word, word.category, context);
    return element;
  }
  constructor(
    word: WordElement | string,
    category: LexicalCategory,
    context: NLGContext,
  ) {
    super(category, context);

    if (typeof word === "string") {
      this.defaultValues = {
        [LexicalFeature.BASE_FORM]: word,
        [InternalFeature.BASE_WORD]: InflectedWordElement.baseWordFromBaseForm(
          word,
          this.context,
          category,
        ),
        [Feature.PERSON]: Person.THIRD,
        [Feature.TENSE]: Tense.PRESENT,
        [Feature.NUMBER]: NumberAgreement.SINGULAR,
      };
    } else {
      this.defaultValues = {
        [LexicalFeature.BASE_FORM]:
          word.defaultSpellingVariant ?? word.baseForm,
        // TODO: Conversion Note: We are unsure the word is a baseWord, so we look it up again, is this correct?
        [InternalFeature.BASE_WORD]: InflectedWordElement.baseWordFromBaseForm(
          word.defaultSpellingVariant ?? word.baseForm,
          this.context,
          word.category,
        ),
        [Feature.PERSON]: Person.THIRD,
        [Feature.TENSE]: Tense.PRESENT,
        [Feature.NUMBER]: NumberAgreement.SINGULAR,
      };
    }
    this.features = { ...this.defaultValues };
  }

  override getChildren(): NLGElement[] {
    return [];
  }

  override toString(): string {
    return `InflectedWordElement[${this.baseForm}:${this.category?.toString()}]`;
  }

  override printTree(_: string): string {
    return `InflectedWordElement: base=${this.baseForm}, category=${this.category?.toString()}, ${super.toString()}\n`;
  }

  get baseForm(): string {
    return this.features[LexicalFeature.BASE_FORM];
  }

  set baseWord(word: WordElement) {
    this.features[InternalFeature.BASE_WORD] = word;
  }

  get baseWord(): WordElement {
    // Conversion note: Moved here from SyntaxProcessor
    const baseWord = this.features[InternalFeature.BASE_WORD];
    if (!(baseWord instanceof WordElement)) {
      const baseWord = InflectedWordElement.baseWordFromBaseForm(
        this.baseForm,
        this.context,
        this.category instanceof LexicalCategory ? this.category : undefined,
      );
      this.baseWord = baseWord;
      return baseWord;
    }
    return baseWord;
  }

  static baseWordFromBaseForm(
    baseForm: string,
    context: NLGContext,
    category?: LexicalCategory,
  ): WordElement {
    return context.lexicon.lookupWord(baseForm, category);
  }
}
