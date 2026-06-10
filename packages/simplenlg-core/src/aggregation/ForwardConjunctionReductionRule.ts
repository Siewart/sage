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
import { PhraseCategory } from "../framework/PhraseCategory.js";
import { AggregationRule } from "./AggregationRule.js";
import { PhraseChecker } from "./PhraseChecker.js";

/**
 * Implementation of the forward conjunction rule. Given two sentences
 * `s1` and `s2`, this rule elides any constituent in the
 * left periphery of `s2` which is also in `s1`. The left
 * periphery in simplenlg is roughly defined as the subjects, front modifiers
 * and cue phrase of an SPhraseSpec.
 *
 * This rule elides any constituent in the left periphery of `s2`
 * which is *lemma-identical* to a constituent with the same function in
 * `s1`, that is, it is headed by the same lexical item, though
 * possibly with different inflectional features and/or modifiers. Note that
 * this means that *the tall man* and *the man* are counted as
 * "identical" for the purposes of this rule. This is only justifiable insofar
 * as the two NPs are co-referential. Since SimpleNLG does not make assumptions
 * about the referentiality (or any part of the semantics) of phrases, it is up
 * to the developer to ensure that this is always the case.
 *
 * The current implementation is loosely based on the algorithm in Harbusch and
 * Kempen (2009), which is described here:
 * http://aclweb.org/anthology-new/W/W09/W09-0624.pdf
 *
 * Implementation note: The current implementation only applies
 * ellipsis to phrasal constituents (i.e. not to their component lexical items).
 *
 * Note: this rule can be used in conjunction with the
 * BackwardConjunctionReductionRule in Aggregator.
 */
export class ForwardConjunctionReductionRule extends AggregationRule {
  /**
   * Creates a new ForwardConjunctionReduction.
   */
  public static create(context: NLGContext): ForwardConjunctionReductionRule {
    return new ForwardConjunctionReductionRule(context);
  }

  private constructor(context: NLGContext) {
    super(context);
  }

  /**
   * Applies forward conjunction reduction to two NLGElements e1 and e2,
   * succeeding only if they are clauses (that is, e1.getCategory() ==
   * e2.getCategory == PhraseCategory.CLAUSE) and
   * the clauses are not passive.
   *
   * @param previous - the first phrase
   * @param next - the second phrase
   * @returns a coordinate phrase if aggregation is successful,
   *    null otherwise
   */
  public applyAggregation(
    previous: NLGElement,
    next: NLGElement,
  ): CoordinatedPhraseElement | undefined {
    let success = false;

    if (
      previous.category === PhraseCategory.CLAUSE &&
      next.category === PhraseCategory.CLAUSE &&
      PhraseChecker.nonePassive(previous, next)
    ) {
      const leftPeriphery = PhraseChecker.leftPeriphery(previous, next);

      for (const pair of leftPeriphery) {
        if (pair.lemmaIdentical()) {
          pair.elideRightmost();
          success = true;
        }
      }
    }

    return success
      ? this.context.factory.createCoordinatedPhrase(previous, next)
      : undefined;
  }
}

