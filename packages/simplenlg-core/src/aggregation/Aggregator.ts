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

import { NLGElement } from "../framework/NLGElement.js";
import { NLGModule } from "../framework/NLGModule.js";
import { AggregationRule } from "./AggregationRule.js";
import { NLGContext } from "../factory/NLGContext.js";

/**
 * An Aggregator performs aggregation on clauses, by applying a set of
 * prespecified rules on them and returning the result.
 *
 * @author Albert Gatt, University of Malya & University of Aberdeen
 */
export class Aggregator extends NLGModule {
  private _rules: AggregationRule[];

  /**
   * Creates an instance of Aggregator
   */
  public static create(context: NLGContext): Aggregator {
    return new Aggregator(context);
  }

  private constructor(context: NLGContext) {
    super(context);
    this._rules = [];
  }

  /**
   * Set the factory that this aggregator should use to create phrases. The
   * factory will be passed on to all the component rules.
   *
   * @param factory the phrase factory
   */
  public override set context(context: NLGContext) {
    super.context = context;

    for (const rule of this._rules) {
      rule.context = this.context;
    }
  }

  public override get context(): NLGContext {
    return super.context;
  }

  /**
   * Add a rule to this aggregator. Aggregation rules are applied in the order
   * in which they are supplied.
   *
   * @param rule the rule
   */
  public addRule(rule: AggregationRule): void {
    rule.context = this.context;
    this._rules.push(rule);
  }

  /**
   * Get the rules in this aggregator.
   *
   * @return the rules
   */
  public get rules(): AggregationRule[] {
    return this._rules;
  }

  /**
   * Apply aggregation to a single phrase. This will only work if the phrase
   * is a coordinated phrase, whose children can be further aggregated.
   */
  public override realise(element: NLGElement): NLGElement {
    let result = element;

    for (const rule of this._rules) {
      const intermediate = rule.applyOneAggregation(result);

      if (intermediate !== undefined) {
        result = intermediate;
      }
    }

    return result;
  }

  /**
   * Apply aggregation to a list of elements. This method iterates through the
   * rules supplied via {@link #addRule(AggregationRule)} and applies them to
   * the elements.
   *
   * @param elements the list of elements to aggregate
   * @return a list of the elements that remain after the aggregation rules
   *    have been applied
   */
  public override realiseAll(elements: NLGElement[]): NLGElement[] {
    for (const rule of this._rules) {
      elements = rule.applyAllAggregation(elements);
    }

    return elements;
  }
}
