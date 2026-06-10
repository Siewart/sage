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
 * Portions created by Ehud Reiter, Albert Gatt and Dave Westwater are Copyright (C)
 * 2010-11 The University of Aberdeen. All Rights Reserved.
 *
 * Contributor(s): Ehud Reiter, Albert Gatt, Dave Westwater, Roman Kutlak, Margaret Mitchell,
 * and Saad Mahamood.
 *
 * TypeScript conversion: Siewart van Wingerden (University of Twente)
 */

import { ElementCategory } from "./ElementCategory.js";
import { BaseFeatureSet, NLGElement } from "./NLGElement.js";
import { StringElement } from "./StringElement.js";
import { ConjunctionType } from "../features/ConjunctionType.js";
import { Feature } from "../features/Feature.js";
import { InternalFeature } from "../features/InternalFeature.js";
import { NumberAgreement } from "../features/NumberAgreement.js";
import { PhraseCategory } from "./PhraseCategory.js";
import { NLGContext } from "../factory/NLGContext.js";
import { cloneInto } from "../utils.js";

export class CoordinatedPhraseElement extends NLGElement {
  override defaultValues: {
    [Feature.CONJUNCTION]: string;
  };

  readonly features: typeof this.defaultValues & Partial<BaseFeatureSet>;

  override resetFeatures(): void {
    cloneInto(this.defaultValues, this.features, true);
  }

  private static readonly PLURAL_COORDINATORS = ["and"] as const; // TODO (later): This is english specific
  static create(
    category: ElementCategory,
    context: NLGContext,
  ): CoordinatedPhraseElement {
    return new CoordinatedPhraseElement(category, context);
  }
  static withCoordinates(
    category: ElementCategory,
    coordinate1: NLGElement | string,
    coordinate2: NLGElement | string,
    context: NLGContext,
  ): CoordinatedPhraseElement {
    return new CoordinatedPhraseElement(
      category,
      context,
      coordinate1,
      coordinate2,
    );
  }

  constructor(
    category: ElementCategory,
    context: NLGContext,
    coordinate1?: NLGElement | string,
    coordinate2?: NLGElement | string,
  ) {
    super(category, context);
    this.defaultValues = {
      [Feature.CONJUNCTION]: CoordinatedPhraseElement.PLURAL_COORDINATORS[0],
    };
    this.features = { ...this.defaultValues };

    this.features[Feature.CONJUNCTION_TYPE] = ConjunctionType.COORDINATING; // Conversion Note: Added this because the documentation says this is done by this class
    if (coordinate1 !== undefined) {
      this.addCoordinate(coordinate1);
    }
    if (coordinate2 !== undefined) {
      this.addCoordinate(coordinate2);
    }
  }

  addCoordinate(newCoordinate: string): void;
  addCoordinate(newCoordinate: NLGElement): void;
  addCoordinate(newCoordinate: NLGElement | string): void; // added for supporting the constructor
  addCoordinate(newCoordinate: NLGElement | string): void {
    let coordinates = this.features[InternalFeature.COORDINATES];

    if (coordinates === undefined) {
      coordinates = [];
    }
    if (coordinates.length === 0) {
      this.features[InternalFeature.COORDINATES] = coordinates;
    }
    let coordinateElement: NLGElement;
    if (newCoordinate instanceof NLGElement) {
      if (newCoordinate.isA(PhraseCategory.CLAUSE) && coordinates.length > 0) {
        newCoordinate.features[Feature.SUPRESSED_COMPLEMENTISER] = true;
      }
      coordinates.push(newCoordinate);
    } else if (typeof newCoordinate === "string") {
      coordinateElement = StringElement.fromString(newCoordinate, this.context);
      coordinateElement.features[Feature.SUPRESSED_COMPLEMENTISER] = true;
      coordinates.push(coordinateElement);
    }
    this.features[InternalFeature.COORDINATES] = coordinates;
  }

  override getChildren(): NLGElement[] {
    return this.features[InternalFeature.COORDINATES] || [];
  }

  clearCoordinates(): void {
    delete this.features[InternalFeature.COORDINATES];
  }

  addPreModifier(newPreModifier: NLGElement | string): void {
    const preModifiers = this.features[InternalFeature.PREMODIFIERS] || [];
    if (typeof newPreModifier === "string") {
      preModifiers.push(StringElement.fromString(newPreModifier, this.context));
    } else {
      preModifiers.push(newPreModifier);
    }
    this.features[InternalFeature.PREMODIFIERS] = preModifiers;
  }

  get preModifiers(): NLGElement[] {
    return this.features[InternalFeature.PREMODIFIERS] || [];
  }

  addPostModifier(newPostModifier: NLGElement | string): void {
    const postModifiers = this.features[InternalFeature.POSTMODIFIERS] || [];
    if (typeof newPostModifier === "string") {
      postModifiers.push(
        StringElement.fromString(newPostModifier, this.context),
      );
    } else {
      postModifiers.push(newPostModifier);
    }
    this.features[InternalFeature.POSTMODIFIERS] = postModifiers;
  }

  get postModifiers(): NLGElement[] {
    return this.features[InternalFeature.POSTMODIFIERS] || [];
  }

  addComplement(newComplement: NLGElement | string): void {
    const complements = this.features[InternalFeature.COMPLEMENTS] || [];
    if (typeof newComplement === "string") {
      complements.push(StringElement.fromString(newComplement, this.context));
    } else {
      complements.push(newComplement);
    }
    this.features[InternalFeature.COMPLEMENTS] = complements;
  }

  get complements(): NLGElement[] {
    return this.features[InternalFeature.COMPLEMENTS] || [];
  }

  get lastCoordinate(): NLGElement | undefined {
    const children = this.getChildren();
    return children.length > 0 ? children[children.length - 1] : undefined;
  }

  set conjunction(conjunction: string) {
    this.features[Feature.CONJUNCTION] = conjunction;
  }

  get conjunction(): string | undefined {
    return this.features[Feature.CONJUNCTION];
  }

  override get plural(): boolean {
    // TODO (Debug): this is supposed to be a separate method
    const size = this.getChildren().length;
    if (size === 1) {
      const lastCoordinate = this.lastCoordinate;
      return (
        lastCoordinate?.features[Feature.NUMBER] === NumberAgreement.PLURAL
      );
    } else {
      const conjunction = this.conjunction;
      return (
        conjunction !== undefined &&
        CoordinatedPhraseElement.PLURAL_COORDINATORS.includes(
          conjunction
            .trimEnd()
            .toLowerCase() as (typeof CoordinatedPhraseElement.PLURAL_COORDINATORS)[number],
        )
      );
    }
  }

  override printTree(indent?: string): string {
    // TODO (later): It would be good to refactor this method to avoid code duplication
    const thisIndent = indent === undefined ? " |-" : indent + " |-";
    const childIndent = indent === undefined ? " | " : indent + " | ";
    const lastIndent = indent === undefined ? " \\-" : indent + " \\-";
    const lastChildIndent = indent === undefined ? "   " : indent + "   ";
    let print = "CoordinatedPhraseElement:\n";

    for (let index = 0; index < this.getChildren().length - 1; index++) {
      print +=
        thisIndent + (this.getChildren()[index]?.printTree(childIndent) ?? "");
    }
    if (this.getChildren().length >= 0) {
      print +=
        lastIndent +
        (this.getChildren()[this.getChildren().length - 1]?.printTree(
          lastChildIndent,
        ) ?? "");
    }
    return print;
  }
}
