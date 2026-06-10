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
import { InternalFeature } from "../features/InternalFeature.js";
import { NLGElement } from "../framework/NLGElement.js";
import { LexicalCategory } from "../framework/LexicalCategory.js";
import { PhraseCategory } from "../framework/PhraseCategory.js";
import { ListElement } from "../framework/ListElement.js";
import { FunctionalSet } from "./FunctionalSet.js";
import { Periphery } from "./Periphery.js";

export class AggregationHelper {
  public static FUNCTIONS = [
    DiscourseFunction.SUBJECT,
    DiscourseFunction.HEAD,
    DiscourseFunction.COMPLEMENT,
    DiscourseFunction.PRE_MODIFIER,
    DiscourseFunction.POST_MODIFIER,
    DiscourseFunction.VERB_PHRASE,
  ];

  public static RECURSIVE = [DiscourseFunction.VERB_PHRASE];

  public static collectFunctionalPairs(
    phrase1: NLGElement,
    phrase2: NLGElement,
  ): FunctionalSet[] {
    const children1 = this.getAllChildren(phrase1);
    const children2 = this.getAllChildren(phrase2);
    const pairs: FunctionalSet[] = [];

    if (children1.length === children2.length) {
      let periph = Periphery.LEFT;

      for (let i = 0; i < children1.length; i++) {
        const child1 = children1[i];
        const child2 = children2[i];
        const cat1 = child1?.category;
        const cat2 = child2?.category;
        const func1 = child1?.features[InternalFeature.DISCOURSE_FUNCTION];
        const func2 = child2?.features[InternalFeature.DISCOURSE_FUNCTION];

        if (
          func1 instanceof DiscourseFunction &&
          cat1 &&
          child1 &&
          child2 &&
          cat1 === cat2 &&
          func1 === func2
        ) {
          const funcSet = FunctionalSet.newInstance(
            func1,
            cat1,
            periph,
            child1,
            child2,
          );
          pairs.push(funcSet);

          if (cat1 === LexicalCategory.VERB) {
            periph = Periphery.RIGHT;
          }
        } else {
          pairs.length = 0;
          break;
        }
      }
    }

    return pairs;
  }

  private static getAllChildren(element: NLGElement): NLGElement[] {
    const children: NLGElement[] = [];
    const components =
      element instanceof ListElement
        ? element.features[InternalFeature.COMPONENTS]
        : element.getChildren();

    for (const child of components ?? []) {
      children.push(child);

      if (
        child.category === PhraseCategory.VERB_PHRASE ||
        child.features[InternalFeature.DISCOURSE_FUNCTION] ===
          DiscourseFunction.VERB_PHRASE
      ) {
        children.push(...this.getAllChildren(child));
      }
    }

    return children;
  }
}
