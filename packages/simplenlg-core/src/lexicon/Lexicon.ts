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
 * Portions created by Ehud Reiter, Albert Gatt and Dave Westwater are Copyright (C) 2010-11
 * The University of Aberdeen. All Rights Reserved.
 *
 * Contributor(s): Ehud Reiter, Albert Gatt, Dave Westwater, Roman Kutlak, Margaret Mitchell,
 * and Saad Mahamood.
 *
 * TypeScript conversion: Siewart van Wingerden (University of Twente)
 */

import { NLGContext } from "../factory/NLGContext.js";
import { LexicalCategory } from "../framework/LexicalCategory.js";
import { WordElement } from "../framework/WordElement.js";

export abstract class Lexicon {
  protected constructor(protected context: NLGContext) {}
  // Adjusted createWord methods with optional category parameter
  protected createWord(
    baseForm: string,
    category?: LexicalCategory,
  ): WordElement {
    return WordElement.create(baseForm, this.context, category);
  }

  // Adjusted lookupWord method with optional category parameter
  public lookupWord(baseForm: string, category?: LexicalCategory): WordElement {
    if (this.hasWord(baseForm, category))
      return this.getWord(baseForm, category);
    else if (this.hasWordFromVariant(baseForm, category))
      return this.getWordFromVariant(baseForm, category);
    else if (this.hasWordByID(baseForm)) return this.getWordByID(baseForm);
    else return this.createWord(baseForm, category);
  }

  public abstract getWords(
    baseForm: string,
    category: LexicalCategory,
  ): WordElement[];

  public abstract getWordsFromVariant(
    variant: string,
    category: LexicalCategory,
  ): WordElement[];

  public close(): void {
    // Do nothing by default
  }

  public getWord(
    baseForm: string,
    category: LexicalCategory = LexicalCategory.ANY,
  ): WordElement {
    const wordElements = this.getWords(baseForm, category);
    if (wordElements[0] === undefined)
      return this.createWord(baseForm, category);
    else
      return this.selectMatchingWord(wordElements, baseForm) ?? wordElements[0];
  }

  private selectMatchingWord(
    wordElements: WordElement[],
    baseForm: string,
  ): WordElement | undefined {
    if (wordElements.length === 0) return this.createWord(baseForm);

    for (const wordElement of wordElements)
      if (wordElement.baseForm === baseForm) return wordElement;

    if (wordElements[0]?.baseForm.toLowerCase() === baseForm.toLowerCase()) {
      return this.createWord(baseForm, LexicalCategory.ANY);
    }

    return undefined;
  }

  public hasWord(
    baseForm: string,
    category: LexicalCategory = LexicalCategory.ANY,
  ): boolean {
    return this.getWords(baseForm, category).length > 0;
  }

  public abstract getWordsByID(id: string): WordElement[];

  public getWordByID(id: string): WordElement {
    const wordElements = this.getWordsByID(id);
    if (wordElements[0] === undefined) return this.createWord(id);
    else return wordElements[0];
  }

  public hasWordByID(id: string): boolean {
    return this.getWordsByID(id).length > 0;
  }

  public getWordFromVariant(
    variant: string,
    category: LexicalCategory = LexicalCategory.ANY,
  ): WordElement {
    const wordElements = this.getWordsFromVariant(variant, category);
    if (wordElements[0] === undefined)
      return this.createWord(variant, category);
    else
      return this.selectMatchingWord(wordElements, variant) ?? wordElements[0];
  }

  public hasWordFromVariant(
    variant: string,
    category: LexicalCategory = LexicalCategory.ANY,
  ): boolean {
    return this.getWordsFromVariant(variant, category).length > 0;
  }
}
