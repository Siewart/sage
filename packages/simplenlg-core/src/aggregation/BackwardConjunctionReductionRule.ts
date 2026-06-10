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
 * Implementation of the backward conjunction reduction rule. Given two
 * sentences <code>s1</code> and <code>s2</code>, this rule elides any
 * constituent in the right periphery of <code>s1</code> which is
 * <I>form-identical</I> to a constituent with the same function in
 * <code>s2</code>, that is, the two constituents are essentially identical in
 * their final, realised, form.
 *
 * <p>
 * The current implementation is loosely based on the algorithm in Harbusch and
 * Kempen (2009), which is described here:
 *
 * <a href="http://aclweb.org/anthology-new/W/W09/W09-0624.pdf">
 * http://aclweb.org/anthology-new/W/W09/W09-0624.pdf</a>
 * </P>
 *
 * <p>
 * <strong>Implementation note:</strong> The current implementation only applies
 * ellipsis to phrasal constituents (i.e. not to their component lexical items).
 * </P>
 * <p>
 * *
 * <p>
 * <STRONG>Note:</STRONG>: this rule can be used in conjunction with the
 * {@link ForwardConjunctionReductionRule} in {@link Aggregator}.
 * </P>
 */
export class BackwardConjunctionReductionRule extends AggregationRule {
  public static create(context: NLGContext): BackwardConjunctionReductionRule {
    return new BackwardConjunctionReductionRule(context);
  }

  /**
   * Applies backward conjunction reduction to two NLGElements e1 and e2,
   * succeeding only if they are clauses (that is, e1.getCategory() ==
   * e2.getCategory == {@link simplenlg.framework.PhraseCategory#CLAUSE}).
   *
   * @param previous the first phrase
   * @param next the second phrase
   * @return a coordinate phrase if aggregation is successful,
   *    <code>undefined</code> otherwise
   */
  public override applyAggregation(
    previous: NLGElement,
    next: NLGElement,
  ): CoordinatedPhraseElement | undefined {
    let success = false;

    if (
      previous.category === PhraseCategory.CLAUSE &&
      next.category === PhraseCategory.CLAUSE &&
      PhraseChecker.nonePassive(previous, next)
    ) {
      const rightPeriphery = PhraseChecker.rightPeriphery(previous, next);

      for (const pair of rightPeriphery) {
        if (pair.lemmaIdentical()) {
          pair.elideLeftmost();
          success = true;
        }
      }
    }

    return success
      ? this.context.factory.createCoordinatedPhrase(previous, next)
      : undefined;
  }
}

