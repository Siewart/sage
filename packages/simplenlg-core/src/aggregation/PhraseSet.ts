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

import { DiscourseFunction } from "../features/DiscourseFunction.js";
import { Feature } from "../features/Feature.js";
import { InternalFeature } from "../features/InternalFeature.js";
import { NLGElement } from "../framework/NLGElement.js";

/**
 * This class wraps an ordered list of phrases which are constituents of two or
 * more (different) clauses and have the same discourse function in their parent
 * clause. FunctionPairs are used by AggregationRules to collect candidate
 * phrase for elision.
 */
export class PhraseSet {
  private _function: DiscourseFunction;
  private _phrases: NLGElement[] = [];

  /**
   * Creates a PhraseSet with a specific function and phrases
   * @param function_ their function
   * @param phrases the list of constituent phrases for the function
   */
  public static fromFunctionAndPhrases(
    func: DiscourseFunction,
    ...phrases: NLGElement[]
  ): PhraseSet {
    const instance = new PhraseSet(func);
    instance.function = func;
    instance.phrases = [...phrases];
    return instance;
  }

  private constructor(func: DiscourseFunction) {
    this._phrases = [];
    this._function = func;
  }

  /**
   * Add a phrase
   * @param phrase the phrase to add
   */
  public addPhrase(phrase: NLGElement): void {
    this._phrases.push(phrase);
  }

  /**
   * Add a collection of phrases.
   * @param phrases the phrases to add
   */
  public addPhrases(phrases: NLGElement[]): void {
    this._phrases.push(...phrases);
  }

  /**
   * @returns the function the pair of phrases have in their respective clauses
   */
  public get function(): DiscourseFunction {
    return this._function;
  }

  private set function(function_: DiscourseFunction) {
    this._function = function_;
  }

  private get phrases(): NLGElement[] {
    return this._phrases;
  }

  private set phrases(phrases: NLGElement[]) {
    this._phrases = phrases;
  }

  /**
   * Elide the rightmost constituents in the phrase list, that is, all phrases
   * except the first.
   */
  public elideRightmost(): void {
    for (let i = 1; i < this._phrases.length; i++) {
      const phrase = this._phrases[i];
      if (phrase !== undefined) {
        phrase.features[Feature.ELIDED] = true;
      }
    }
  }

  /**
   * Elide the leftmost constituents in the phrase list, that is, all phrases
   * except the rightmost.
   */
  public elideLeftmost(): void {
    for (let i = this._phrases.length - 2; i >= 0; i--) {
      const phrase = this._phrases[i];
      if (phrase !== undefined) {
        phrase.features[Feature.ELIDED] = true;
      }
    }
  }

  /**
   * Check whether the phrases are lemma identical. This method returns
   * true in the following cases:
   *
   * 1. All phrases are NLGElements and they have the same lexical head,
   *    irrespective of inflectional variations.
   *
   * @returns true if the pair is lemma identical
   */
  public lemmaIdentical(): boolean {
    let ident = this._phrases.length > 0;

    for (let i = 1; i < this._phrases.length && ident; i++) {
      const left = this._phrases[i - 1];
      const right = this._phrases[i];

      if (left !== undefined && right !== undefined) {
        const leftHead = left.features[InternalFeature.HEAD];
        const rightHead = right.features[InternalFeature.HEAD];
        ident =
          (leftHead === rightHead || leftHead?.equals(rightHead)) ?? false;
      }
    }

    return ident;
  }

  /**
   * Check whether the phrases in this set are identical in form. This method
   * returns true if for every pair of phrases p1 and p2,
   * p1.equals(p2).
   *
   * @returns true if all phrases in the set are form-identical
   */
  public formIdentical(): boolean {
    let ident = this._phrases.length > 0;

    for (let i = 1; i < this._phrases.length && ident; i++) {
      const left = this._phrases[i - 1];
      const right = this._phrases[i];

      if (left !== undefined && right !== undefined) {
        ident = left?.equals(right);
      }
    }

    return ident;
  }
}
