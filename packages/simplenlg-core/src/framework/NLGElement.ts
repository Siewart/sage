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
import { FeatureSet, Feature } from "../features/Feature.js";
import { InternalFeatureSet } from "../features/InternalFeature.js";
import { LexicalFeatureSet } from "../features/LexicalFeature.js";
import { NumberAgreement } from "../features/NumberAgreement.js";
import { cloneInto, javaLikeEquals } from "../utils.js";
import { ElementCategory } from "./ElementCategory.js";

export type BaseFeatureSet = FeatureSet &
  InternalFeatureSet &
  LexicalFeatureSet & { [K in string]: number | string | boolean | object } & {
    debug?: string;
  };

export abstract class NLGElement {
  protected abstract defaultValues: typeof this.features;

  public abstract readonly features: Partial<BaseFeatureSet>;

  get category(): ElementCategory {
    return this._category;
  }

  set category(newCategory: ElementCategory) {
    this._category = newCategory;
  }

  private _parent: NLGElement | undefined = undefined;

  get parent(): NLGElement | undefined {
    return this._parent;
  }

  set parent(newParent: NLGElement | undefined) {
    this._parent = newParent;
  }
  private _realisation?: string = undefined;

  set realisation(realised: string) {
    this._realisation = realised;
  }

  get realisation(): string {
    if (this._realisation !== undefined) {
      this._realisation = this._realisation.replace(/^[ \t]+|[ \t]+$/g, "");
      return this._realisation;
    }
    return "";
  }

  protected constructor(
    protected _category: ElementCategory,
    private _context: NLGContext,
  ) {}

  // shallow copy
  getAllFeatures(): typeof this.features {
    return { ...this.features };
  }

  resetFeatures(): void {
    cloneInto(this.defaultValues, this.features, true);
  }

  toString(): string {
    let buffer = `{realisation=${this._realisation}`;

    if (this.category != null) {
      buffer += `, category=${this.category.toString()}`;
    }

    if (this.features != null) {
      buffer += `, features=${JSON.stringify(this.features, (k, v) => (["_context", "_parent"].includes(k) ? undefined : v), 2)}}`;
    }

    buffer += "}";
    return buffer;
  }

  //Conversion Note: undefined/null no longer allowed as checkCategory compared to original Java code, add your own check if needed `c === false ? true : e.isA(...))`
  isA(checkCategory: ElementCategory): boolean {
    return this.category.equalTo(checkCategory);
  }

  abstract getChildren(): NLGElement[];

  getAllFeatureNames(): (keyof typeof this.features)[] {
    return Object.keys(this.features) as (keyof typeof this.features)[];
  }

  printTree(indent: string = ""): string {
    const thisIndent = indent + " |-";
    const childIndent = indent + " |-";
    let print = `NLGElement: ${this.toString()}\n`;

    const children = this.getChildren();

    for (const eachChild of children) {
      print += thisIndent + eachChild.printTree(childIndent);
    }

    return print;
  }

  set plural(isPlural: boolean) {
    if (isPlural) {
      this.features[Feature.NUMBER] = NumberAgreement.PLURAL;
    } else {
      this.features[Feature.NUMBER] = NumberAgreement.SINGULAR;
    }
  }

  get plural(): boolean {
    return this.features[Feature.NUMBER] === NumberAgreement.PLURAL;
  }

  get context(): NLGContext {
    return this._context;
  }

  set context(context: NLGContext) {
    this._context = context;
  }

  equals(o: unknown): boolean {
    if (typeof o === "string") {
      return o === this.realisation;
    } else if (o instanceof NLGElement) {
      return (
        this.category === o.category &&
        javaLikeEquals(this.features, o.features)
      );
    }
    return false;
  }
}
