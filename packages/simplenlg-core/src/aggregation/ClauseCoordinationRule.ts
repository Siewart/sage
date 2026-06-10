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
import { CoordinatedPhraseElement } from "../framework/CoordinatedPhraseElement.js";
import { LexicalCategory } from "../framework/LexicalCategory.js";
import { NLGElement } from "../framework/NLGElement.js";
import { PhraseCategory } from "../framework/PhraseCategory.js";
import { WordElement } from "../framework/WordElement.js";
import { copyField } from "../utils.js";
import { AggregationRule } from "./AggregationRule.js";
import { PhraseChecker } from "./PhraseChecker.js";

/**
 * Implementation of a clausal coordination rule. The rule performs the
 * following operations on sentences:
 *
 * <OL>
 * <LI>If the sentences have the same subject, a new sentence is returned with
 * that subject, and the VP from the component sentences conjoined. For example
 * <I>John kicked the ball.</I> and <I>John sang a song.</I> becomes <I>John
 * kicked the ball and sang a song</I>.</LI>
 * <LI>If the sentences have the same VP, a new sentence is returned with that
 * VP, and the subjects from the component sentences conjoined. For example
 * <I>John kicked the ball.</I> and <I>Mary kicked the ball.</I> become <I>John
 * and Mary kicked the ball</I>.</LI>
 * </OL>
 *
 * These operations only apply to sentences whose front modifiers are identical,
 * that is, sentences where, for every pair <code>s1</code> and <code>s2</code>,
 * <code>s1.getFrontModifiers().equals(s2.getFrontModifiers())</code>.
 *
 * <STRONG>Note:</STRONG>: it is not recommended to use this rule in addition to
 * BackwardConjunctionReductionRule and/or ForwardConjunctionReductionRule.
 */
export class ClauseCoordinationRule extends AggregationRule {
  /**
   * Creates an instance of the ClauseCoordinationRule
   */
  public static create(context: NLGContext): ClauseCoordinationRule {
    return new ClauseCoordinationRule(context);
  }

  private constructor(context: NLGContext) {
    super(context);
  }

  /**
   * Applies aggregation to two NLGElements e1 and e2, succeeding only if they
   * are clauses (that is, e1.getCategory() == e2.getCategory ==
   * PhraseCategory.CLAUSE).
   */
  public applyAggregation(
    previous: NLGElement,
    next: NLGElement,
  ): CoordinatedPhraseElement | undefined {
    let aggregated: NLGElement | undefined = undefined;

    if (
      previous.category === PhraseCategory.CLAUSE &&
      next.category === PhraseCategory.CLAUSE &&
      PhraseChecker.nonePassive(previous, next) &&
      !PhraseChecker.expletiveSubjects(previous, next)
    ) {
      // case 1: identical sentences: remove the current
      if (PhraseChecker.sameSentences(previous, next)) {
        aggregated = previous;
      }
      // case 2: subjects identical: coordinate VPs
      else if (
        PhraseChecker.sameFrontMods(previous, next) &&
        PhraseChecker.sameSubjects(previous, next) &&
        PhraseChecker.samePostMods(previous, next)
      ) {
        let vp: NLGElement | undefined = undefined;
        // case 2.1: VPs have different arguments but same head & mods
        if (
          !PhraseChecker.sameVPArgs(previous, next) &&
          PhraseChecker.sameVPHead(previous, next) &&
          PhraseChecker.sameVPModifiers(previous, next)
        ) {
          const vp1 = previous.features[InternalFeature.VERB_PHRASE];
          vp = this.context.factory.createVerbPhrase(
            vp1?.features[InternalFeature.HEAD] ?? "",
          );

          if (vp1?.features[InternalFeature.HEAD] === undefined) {
            // sameVPHead ensures that the head is not undefined, so this should never heappen
            console.error(
              "This should never happen: No vp or head found in previous element. When applying aggregation. Making a new empty element. Using empty word.",
            );
          }

          if (vp1) {
            copyField(
              vp1.features,
              vp.features,
              InternalFeature.COMPLEMENTS,
              true,
            );
            copyField(
              vp1.features,
              vp.features,
              InternalFeature.PREMODIFIERS,
              true,
            );
            copyField(
              vp1.features,
              vp.features,
              InternalFeature.POSTMODIFIERS,
              true,
            );
          }
        }
        // case 2.2: just create a coordinate VP
        else {
          const vp1 = previous.features[InternalFeature.VERB_PHRASE];
          const vp2 = next.features[InternalFeature.VERB_PHRASE];
          vp = this.context.factory.createCoordinatedPhrase(vp1, vp2);
        }

        aggregated = this.context.factory.createClauseVP(vp);

        copyField(
          previous.features,
          aggregated.features,
          InternalFeature.SUBJECTS,
          true,
        );

        copyField(
          previous.features,
          aggregated.features,
          InternalFeature.FRONT_MODIFIERS,
          true,
        );

        copyField(
          previous.features,
          aggregated.features,
          Feature.CUE_PHRASE,
          true,
        );

        copyField(
          previous.features,
          aggregated.features,
          InternalFeature.POSTMODIFIERS,
          true,
        );
      }
      // case 3: identical VPs: conjoin subjects and front modifiers
      else if (
        PhraseChecker.sameFrontMods(previous, next) &&
        PhraseChecker.sameVP(previous, next) &&
        PhraseChecker.samePostMods(previous, next)
      ) {
        const subjects = this.context.factory.createCoordinatedPhrase();
        subjects.category = PhraseCategory.NOUN_PHRASE;
        const allSubjects = [
          ...(previous.features[InternalFeature.SUBJECTS] || []),
          ...(next.features[InternalFeature.SUBJECTS] || []),
        ];

        for (const subj of allSubjects) {
          subjects.addCoordinate(subj);
        }

        const verbPhrase = previous.features[InternalFeature.VERB_PHRASE];
        if (verbPhrase) {
          aggregated = this.context.factory.createClauseVP(verbPhrase);
        } else {
          // sameVP ensures that the vp is not undefined, so this should never heappen
          console.error(
            "Should never happen: No verb phrase found in previous element. Making a new empty element.",
          );
          aggregated = this.context.factory.createClauseVP(
            WordElement.create("", this.context, LexicalCategory.ANY),
          );
        }

        const frontModifiers =
          previous.features[InternalFeature.FRONT_MODIFIERS];
        if (frontModifiers) {
          aggregated.features[InternalFeature.FRONT_MODIFIERS] = frontModifiers;
        }
        aggregated.features[InternalFeature.SUBJECTS] = [subjects];

        copyField(
          previous.features,
          aggregated.features,
          InternalFeature.POSTMODIFIERS,
          true,
        );
        // copyField(
        //   previous.features,
        //   aggregated.features,
        //   InternalFeature.VERB_PHRASE,
        //   true,
        // );
      }
    }

    return aggregated instanceof CoordinatedPhraseElement
      ? aggregated
      : this.context.factory.createCoordinatedPhrase(aggregated);
  }
}

