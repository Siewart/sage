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
import { NLGElement } from "../framework/NLGElement.js";
import { NLGModule } from "../framework/NLGModule.js";
import { PhraseCategory } from "../framework/PhraseCategory.js";
import { PhraseElement } from "../framework/PhraseElement.js";
import { SyntaxProcessor } from "../syntax/english/SyntaxProcessor.js";
import { AggregationHelper } from "./AggregationHelper.js";
import { FunctionalSet } from "./FunctionalSet.js";
import { Periphery } from "./Periphery.js";

export class NewAggregator extends NLGModule {
  public override realise(_element: NLGElement): NLGElement {
    // not implemented in Java code either
    throw new Error("Method not implemented. Use realiseAggregate instead.");
  }
  public override realiseAll(_elements: NLGElement[]): NLGElement[] {
    // not implemented in Java code either
    throw new Error("Method not implemented. Use realiseAggregate instead.");
  }
  private _syntax: SyntaxProcessor;

  public static create(context: NLGContext): NewAggregator {
    return new NewAggregator(context);
  }

  private constructor(context: NLGContext) {
    super(context);
    this._syntax = new SyntaxProcessor(context);
  }

  public realiseAggregate(
    phrase1: NLGElement,
    phrase2: NLGElement,
  ): NLGElement | undefined {
    let result: NLGElement | undefined = undefined;

    if (
      phrase1 instanceof PhraseElement &&
      phrase2 instanceof PhraseElement &&
      phrase1.category === PhraseCategory.CLAUSE &&
      phrase2.category === PhraseCategory.CLAUSE
    ) {
      const funcSets = AggregationHelper.collectFunctionalPairs(
        this._syntax.realise(phrase1),
        this._syntax.realise(phrase2),
      );

      this.applyForwardConjunctionReduction(funcSets);
      this.applyBackwardConjunctionReduction(funcSets);
      result = this.context.factory.createCoordinatedPhrase(phrase1, phrase2);
    }

    return result;
  }

  private applyForwardConjunctionReduction(funcSets: FunctionalSet[]): void {
    for (const pair of funcSets) {
      if (pair.periphery === Periphery.LEFT && pair.formIdentical()) {
        pair.elideRightMost();
      }
    }
  }

  private applyBackwardConjunctionReduction(funcSets: FunctionalSet[]): void {
    for (const pair of funcSets) {
      if (pair.periphery === Periphery.RIGHT && pair.formIdentical()) {
        pair.elideLeftMost();
      }
    }
  }
}
