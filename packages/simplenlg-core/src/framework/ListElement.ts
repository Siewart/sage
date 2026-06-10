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
import { InternalFeature } from "../features/InternalFeature.js";
import { ElementCategory } from "./ElementCategory.js";
import { BaseFeatureSet, NLGElement } from "./NLGElement.js";
import { cloneInto } from "../utils.js";

export class ListElement extends NLGElement {
  override defaultValues: {
    [k in string]: string | number | boolean | object | undefined;
  };

  readonly features: typeof this.defaultValues & Partial<BaseFeatureSet>;

  override resetFeatures(): void {
    cloneInto(this.defaultValues, this.features, true);
  }

  /**
   * Creates a new list element with no components.
   */
  public static create(
    category: ElementCategory,
    context: NLGContext,
  ): ListElement {
    return new ListElement(category, context);
  }

  /**
   * Creates a new list element containing the given components.
   */
  public static fromComponents(
    components: NLGElement[],
    category: ElementCategory,
    context: NLGContext,
  ): ListElement {
    const element = new ListElement(category, context);
    element.addComponents(components);
    return element;
  }

  /**
   * Creates a new list element containing the given component.
   */
  public static fromComponent(
    component: NLGElement,
    category: ElementCategory,
    context: NLGContext,
  ): ListElement {
    const element = new ListElement(category, context);
    element.addComponent(component);
    return element;
  }

  private constructor(category: ElementCategory, context: NLGContext) {
    super(category, context);
    this.defaultValues = {};
    this.features = { ...this.defaultValues };
  }

  public override getChildren(): NLGElement[] {
    return this.features[InternalFeature.COMPONENTS] ?? [];
  }

  /**
   * Adds the given component to the list element.
   */
  public addComponent(newComponent: NLGElement): void {
    const components = this.features[InternalFeature.COMPONENTS] ?? [];
    this.features[InternalFeature.COMPONENTS] = components;
    components.push(newComponent);
  }

  /**
   * Adds the given components to the list element.
   */
  public addComponents(newComponents: NLGElement[]): void {
    let components = this.features[InternalFeature.COMPONENTS];
    if (components === undefined) {
      components = [];
    }
    this.features[InternalFeature.COMPONENTS] = components;
    components.push(...newComponents);
  }

  /**
   * Replaces the current components in the list element with the given list.
   */
  public setComponents(newComponents: NLGElement[]): void {
    this.features[InternalFeature.COMPONENTS] = newComponents;
  }

  public override toString(): string {
    return this.getChildren().toString();
  }

  public override printTree(indent?: string): string {
    const thisIndent = indent === null ? " |-" : indent + " |-";
    const childIndent = indent === null ? " | " : indent + " | ";
    const lastIndent = indent === null ? " \\-" : indent + " \\-";
    const lastChildIndent = indent === null ? "   " : indent + "   ";
    const print: string[] = [];
    print.push("ListElement: features={");

    const features = this.getAllFeatures();
    for (const [key, value] of Object.entries(features)) {
      print.push(`${key}=${value?.toString()} `);
    }
    print.push("}\n");

    const children = this.getChildren();
    const length = children.length - 1;

    for (let index = 0; index < length; index++) {
      print.push(thisIndent + children[index]?.printTree(childIndent));
    }
    if (length >= 0) {
      print.push(lastIndent + children[length]?.printTree(lastChildIndent));
    }
    return print.join("");
  }

  /**
   * Retrieves the number of components in this list element.
   */
  public get size(): number {
    return this.getChildren().length;
  }

  /**
   * Retrieves the first component in the list.
   */
  public get first(): NLGElement | undefined {
    const children = this.getChildren();
    return children[0] ?? undefined;
  }
}
