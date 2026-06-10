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
import { cloneInto } from "../utils.js";
import { DocumentCategory } from "./DocumentCategory.js";
import { BaseFeatureSet, NLGElement } from "./NLGElement.js";

export class DocumentElement extends NLGElement {
  override defaultValues: {
    [k in string]: string | number | boolean | object | undefined;
  };

  readonly features: typeof this.defaultValues &
    Partial<
      BaseFeatureSet & {
        [DocumentElement.FEATURE_TITLE]: string;
        [DocumentElement.FEATURE_COMPONENTS]: NLGElement[];
      }
    >;

  override resetFeatures(): void {
    cloneInto(this.defaultValues, this.features, true);
  }

  private static readonly FEATURE_TITLE = "textTitle";
  private static readonly FEATURE_COMPONENTS = "textComponents";

  public static fromCategory(
    category: DocumentCategory,
    context: NLGContext,
    textTitle?: string,
  ): DocumentElement {
    const element = new DocumentElement(category, context, textTitle);
    return element;
  }

  constructor(
    category: DocumentCategory,
    context: NLGContext,
    textTitle?: string,
  ) {
    super(category, context);
    this.defaultValues = {};
    this.features = { ...this.defaultValues };
    this.title = textTitle;
  }

  public set title(textTitle: string | undefined) {
    if (textTitle === undefined) {
      delete this.features[DocumentElement.FEATURE_TITLE];
      return;
    } else {
      this.features[DocumentElement.FEATURE_TITLE] = textTitle;
    }
  }

  public get title(): string | undefined {
    return this.features[DocumentElement.FEATURE_TITLE] ?? undefined;
  }

  public get components(): NLGElement[] {
    return this.features[DocumentElement.FEATURE_COMPONENTS] ?? [];
  }

  public set components(components: NLGElement[] | undefined) {
    if (components !== undefined) {
      this.features[DocumentElement.FEATURE_COMPONENTS] = components;
    }
  }

  public addComponent(element: NLGElement): void {
    const category = element.category;

    if (category && this.category instanceof DocumentCategory) {
      if (this.category.hasSubPart(category)) {
        this.addElementToComponents(element);
      } else {
        const promotedElement = this.promote(element);
        if (promotedElement) {
          this.addElementToComponents(promotedElement);
        } else {
          this.addElementToComponents(element);
        }
      }
    } else {
      this.addElementToComponents(element);
    }
  }

  private addElementToComponents(element: NLGElement): void {
    const components = this.components ?? [];
    components.push(element);
    element.parent = this;
    this.setComponents(components);
  }

  private promote(element: NLGElement): NLGElement | undefined {
    if (!(this.category instanceof DocumentCategory)) return undefined;

    if (this.category.hasSubPart(element.category)) {
      return element;
    }

    if (!(element instanceof DocumentElement)) {
      const sentence = DocumentElement.fromCategory(
        DocumentCategory.SENTENCE,
        this.context,
      );
      sentence.addElementToComponents(element);
      return this.promote(sentence);
    }

    if (element.category === DocumentCategory.SENTENCE) {
      const paragraph = DocumentElement.fromCategory(
        DocumentCategory.PARAGRAPH,
        this.context,
      );
      paragraph.addElementToComponents(element);
      return this.promote(paragraph);
    }

    return undefined;
  }

  public addComponents(textComponents: NLGElement[]): void {
    // TODO (later): addComponents is not the same as addComponent over a list, this method lacks promotion. This is not ideal design, but there may be code relying on this difference in the code base. We leave it for now.
    const thisCategory = this.category;
    const elementsToAdd: NLGElement[] = [];

    for (const element of textComponents) {
      const category = element.category;
      if (category && thisCategory instanceof DocumentCategory) {
        if (thisCategory.hasSubPart(category)) {
          elementsToAdd.push(element);
          element.parent = this;
        }
      }
    }

    if (elementsToAdd.length > 0) {
      const components = this.components ?? [];
      components.push(...elementsToAdd);
      this.features[DocumentElement.FEATURE_COMPONENTS] = components;
    }
  }

  public removeComponent(textComponent: NLGElement): boolean {
    const components = this.components;
    if (!components) return false;

    const index = components.indexOf(textComponent);
    if (index === -1) return false;

    components.splice(index, 1);
    this.components = components;
    return true;
  }

  public clearComponents(): void {
    const components = this.components;
    if (components) {
      components.length = 0;
    }
  }

  public override getChildren(): NLGElement[] {
    return this.components ?? [];
  }

  public setComponents(components: NLGElement[]): void {
    this.features[DocumentElement.FEATURE_COMPONENTS] = components;
  }

  public override printTree(indent?: string): string {
    const thisIndent = indent === undefined ? " |-" : `${indent} |-`;
    const childIndent = indent === undefined ? " | " : `${indent} | `;
    const lastIndent = indent === undefined ? " \\-" : `${indent} \\-`;
    const lastChildIndent = indent === undefined ? "   " : `${indent}   `;

    const print: string[] = [];
    print.push(`DocumentElement: category=${this.category?.toString()}`);

    const realisation = this.realisation;
    if (realisation) {
      print.push(` realisation=${realisation}`);
    }
    print.push("\n");

    const children = this.getChildren();
    const length = children.length - 1;

    if (children.length > 0) {
      for (let i = 0; i < length; i++) {
        print.push(thisIndent + children[i]?.printTree(childIndent));
      }
      print.push(lastIndent + children[length]?.printTree(lastChildIndent));
    }

    return print.join("");
  }
}
