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
import { CoordinatedPhraseElement } from "../framework/CoordinatedPhraseElement.js";
import { NLGElement } from "../framework/NLGElement.js";
import { cloneInto } from "../utils.js";

export abstract class AggregationRule {
  protected constructor(context: NLGContext) {
    this._context = context;
  }
  protected _context: NLGContext;

  public get context(): NLGContext {
    return this._context;
  }

  public set context(context: NLGContext) {
    this._context = context;
  }
  // renamed apply from original Java code to unshadow the global apply function
  public applyAllAggregation(
    phrases: NLGElement[],
  ): CoordinatedPhraseElement[] {
    const results: CoordinatedPhraseElement[] = [];

    if (phrases.length >= 2) {
      const removed: NLGElement[] = [];

      for (let i = 0; i < phrases.length; i++) {
        let current = phrases[i];

        if (current === undefined || removed.includes(current)) {
          continue;
        }

        for (let j = i + 1; j < phrases.length; j++) {
          const next = phrases[j];
          if (next === undefined) continue;

          const aggregated = this.applyAggregation(current, next);

          if (aggregated) {
            current = aggregated;
            removed.push(next);
          }
        }
        if (!(current instanceof CoordinatedPhraseElement)) {
          const coord = this.context.factory.createCoordinatedPhrase(current);
          results.push(coord);
          current = coord;
        } else {
          results.push(current);
        }
      }
    } else if (phrases.length === 1) {
      if (phrases[0]) {
        const aggregated = this.applyOneAggregation(phrases[0]);
        if (aggregated) results.push(aggregated);
      }
    }

    return results;
  }

  public applyOneAggregation(
    phrase: NLGElement,
  ): CoordinatedPhraseElement | undefined {
    let result: CoordinatedPhraseElement | undefined = undefined;

    if (phrase instanceof CoordinatedPhraseElement) {
      const children = phrase.getChildren();
      const aggregated = this.applyAllAggregation(children);

      if (aggregated.length === 1 && aggregated[0] !== undefined) {
        result = this.context.factory.createCoordinatedPhrase(aggregated[0]);
      } else {
        result = this.context.factory.createCoordinatedPhrase();

        for (const agg of aggregated) {
          if (result instanceof CoordinatedPhraseElement) {
            result.addCoordinate(agg);
          }
        }
      }
    }

    if (result) {
      cloneInto(phrase.features, result.features, false);
    }

    return result;
  }

  /**
   * Performs aggregation on a pair of sentences. This is the only method that
   * extensions of <code>AggregationRule</code> need to implement.
   *
   * @param sentence1 the first sentence
   * @param sentence2 the second sentence
   * @return an aggregated sentence, if the method succeeds, <code>null</code>
   * 		otherwise
   */
  public abstract applyAggregation(
    sentence1: NLGElement,
    sentence2: NLGElement,
  ): CoordinatedPhraseElement | undefined;
}

