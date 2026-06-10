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
import { ElementCategory } from "../framework/ElementCategory.js";
import { ListElement } from "../framework/ListElement.js";
import { NLGElement } from "../framework/NLGElement.js";
import { Periphery } from "./Periphery.js";

export class FunctionalSet {
  private _components: NLGElement[];
  private _function: DiscourseFunction;
  private _category: ElementCategory;
  private _periphery: Periphery;

  private constructor(
    func: DiscourseFunction,
    category: ElementCategory,
    periphery: Periphery,
    components: NLGElement[],
  ) {
    this._function = func;
    this._category = category;
    this._periphery = periphery;
    this._components = components;
  }

  public static newInstance(
    func: DiscourseFunction,
    category: ElementCategory,
    periphery: Periphery,
    ...components: [NLGElement, NLGElement, ...NLGElement[]] // we require at least two NLGElements
  ): FunctionalSet {
    return new FunctionalSet(func, category, periphery, components);
  }

  public formIdentical(): boolean {
    let ident = true;
    const firstElement = this._components[0];

    for (let i = 1; i < this._components.length && ident; i++) {
      ident = firstElement?.equals(this._components[i]) ?? false;
    }

    return ident;
  }

  public lemmaIdentical(): boolean {
    return false;
  }

  public elideLeftMost(): void {
    for (let i = 0; i < this._components.length - 1; i++) {
      const c = this._components[i];
      if (c) this.recursiveElide(c);
    }
  }

  public elideRightMost(): void {
    for (let i = this._components.length - 1; i > 0; i--) {
      const c = this._components[i];
      if (c) this.recursiveElide(c);
    }
  }

  private recursiveElide(component: NLGElement): void {
    if (component instanceof ListElement) {
      const components = component.features[InternalFeature.COMPONENTS] ?? [];
      for (const subcomponent of components) {
        this.recursiveElide(subcomponent);
      }
    } else {
      component.features[Feature.ELIDED] = true;
    }
  }

  public get function(): DiscourseFunction {
    return this._function;
  }

  public get category(): ElementCategory {
    return this._category;
  }

  public get periphery(): Periphery {
    return this._periphery;
  }

  public get components(): NLGElement[] {
    return this._components;
  }

  public toString(): string {
    return this._components
      .map((elem) => `ELEMENT: ${elem.toString()}\n`)
      .join("");
  }
}
