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

import { ClauseStatus } from "../features/ClauseStatus.js";
import { DiscourseFunction } from "../features/DiscourseFunction.js";
import { Feature } from "../features/Feature.js";
import { InternalFeature } from "../features/InternalFeature.js";
import { BaseFeatureSet, NLGElement } from "./NLGElement.js";
import { PhraseCategory } from "./PhraseCategory.js";
import { StringElement } from "./StringElement.js";
import { cloneInto } from "../utils.js";
import { CoordinatedPhraseElement } from "./CoordinatedPhraseElement.js";

export abstract class PhraseElement extends NLGElement {
  abstract override defaultValues: {
    [Feature.ELIDED]: boolean;
    // [InternalFeature.HEAD]: NLGElement;
  };

  abstract override readonly features: typeof this.defaultValues &
    Partial<BaseFeatureSet>;

  override resetFeatures(): void {
    cloneInto(this.defaultValues, this.features, true);
  }

  getChildren(): NLGElement[] {
    const children: NLGElement[] = [];
    const category = this.category;

    if (category instanceof PhraseCategory) {
      switch (category) {
        case PhraseCategory.CLAUSE: {
          const cuePhrase = this.features[Feature.CUE_PHRASE];
          if (cuePhrase) {
            children.push(cuePhrase);
          }
          children.push(
            ...(this.features[InternalFeature.FRONT_MODIFIERS] ?? []),
          );
          children.push(...(this.features[InternalFeature.PREMODIFIERS] ?? []));
          children.push(...(this.features[InternalFeature.SUBJECTS] ?? []));
          const verbPhrase = this.features[InternalFeature.VERB_PHRASE];
          if (verbPhrase) children.push(verbPhrase);
          children.push(...(this.features[InternalFeature.COMPLEMENTS] ?? []));
          if (this.head) children.push(this.head); // TODO (later): Conversion Note: Added this, but it may end up adding the same element twice since it may be the subjecdt or VP
          break;
        }
        case PhraseCategory.NOUN_PHRASE: {
          const specifier = this.features[InternalFeature.SPECIFIER];
          if (specifier) {
            children.push(specifier);
          }
          children.push(...(this.features[InternalFeature.PREMODIFIERS] ?? []));
          if (this.head) children.push(this.head);

          children.push(...(this.features[InternalFeature.COMPLEMENTS] ?? []));
          children.push(
            ...(this.features[InternalFeature.POSTMODIFIERS] ?? []),
          );
          break;
        }
        case PhraseCategory.VERB_PHRASE: {
          children.push(...(this.features[InternalFeature.PREMODIFIERS] ?? []));

          if (this.head) children.push(this.head);

          children.push(...(this.features[InternalFeature.COMPLEMENTS] ?? []));
          children.push(
            ...(this.features[InternalFeature.POSTMODIFIERS] ?? []),
          );
          break;
        }
        case PhraseCategory.CANNED_TEXT: {
          // Do nothing
          break;
        }
        default: {
          children.push(...(this.features[InternalFeature.PREMODIFIERS] ?? []));
          if (this.head) children.push(this.head);

          children.push(...(this.features[InternalFeature.COMPLEMENTS] ?? []));
          children.push(
            ...(this.features[InternalFeature.POSTMODIFIERS] ?? []),
          );
          break;
        }
      }
    }
    return children;
  }
  // TODO (later): removed unsetting here using undefined to unset here, elsewhere null is used - needs to be consistent, undefined may be better for practical use, but null is more semantically explicit
  set head(newHead: NLGElement | undefined) {
    if (newHead === undefined) {
      delete this.features[InternalFeature.HEAD];
      return;
    }

    this.features[InternalFeature.HEAD] = newHead;
  }

  get head(): NLGElement | undefined {
    return this.features[InternalFeature.HEAD];
  }

  addComplement(complement: NLGElement | string): void {
    const newComplement =
      complement instanceof NLGElement
        ? complement
        : StringElement.fromString(complement, this.context);
    let complements = this.features[InternalFeature.COMPLEMENTS];
    if (!complements) {
      complements = [];
    }

    if (!(InternalFeature.DISCOURSE_FUNCTION in newComplement.features)) {
      newComplement.features[InternalFeature.DISCOURSE_FUNCTION] =
        DiscourseFunction.OBJECT;
    }

    complements.push(newComplement);
    this.features[InternalFeature.COMPLEMENTS] = complements;
    if (
      newComplement.isA(PhraseCategory.CLAUSE) ||
      newComplement instanceof CoordinatedPhraseElement
    ) {
      newComplement.features[InternalFeature.CLAUSE_STATUS] =
        ClauseStatus.SUBORDINATE;

      // TODO (later): is this redundant with the above?
      if (!(InternalFeature.DISCOURSE_FUNCTION in newComplement.features)) {
        newComplement.features[InternalFeature.DISCOURSE_FUNCTION] =
          DiscourseFunction.OBJECT;
      }
    }
  }

  setComplement(newComplement: NLGElement | string): void {
    if (typeof newComplement !== "string") {
      const func = newComplement.features[InternalFeature.DISCOURSE_FUNCTION];
      if (func) this.removeComplements(func);
    }
    const complement =
      typeof newComplement === "string"
        ? StringElement.fromString(newComplement, this.context)
        : newComplement;
    this.addComplement(complement);
  }

  private removeComplements(func: DiscourseFunction): void {
    const complements = this.features[InternalFeature.COMPLEMENTS];
    if (!complements) return;
    const complementsToRemove = complements.filter(
      (complement) =>
        func === complement.features[InternalFeature.DISCOURSE_FUNCTION],
    );

    if (complementsToRemove.length > 0) {
      this.features[InternalFeature.COMPLEMENTS] = complements.filter(
        (complement) => !complementsToRemove.includes(complement),
      );
    }
  }

  addComplementString(newComplement: string): void {
    const newElement = StringElement.fromString(newComplement, this.context);
    let complements = this.features[InternalFeature.COMPLEMENTS];
    if (!complements) {
      complements = [];
    }
    complements.push(newElement);
    this.features[InternalFeature.COMPLEMENTS] = complements;
  }

  setComplementString(newComplement: string): void {
    delete this.features[InternalFeature.COMPLEMENTS];
    this.addComplementString(newComplement);
  }

  addPostModifier(newPostModifier: NLGElement | string): void {
    let postModifiers = this.features[InternalFeature.POSTMODIFIERS];
    if (!postModifiers) {
      postModifiers = [];
    }

    if (typeof newPostModifier === "string") {
      postModifiers.push(
        StringElement.fromString(newPostModifier, this.context),
      );
    } else {
      newPostModifier.features[InternalFeature.DISCOURSE_FUNCTION] =
        DiscourseFunction.POST_MODIFIER;
      postModifiers.push(newPostModifier);
    }
    this.features[InternalFeature.POSTMODIFIERS] = postModifiers;
  }

  setPostModifier(newPostModifier: NLGElement | string): void {
    delete this.features[InternalFeature.POSTMODIFIERS];
    this.addPostModifier(newPostModifier);
  }

  addFrontModifier(newFrontModifier: NLGElement | string): void {
    let frontModifiers = this.features[InternalFeature.FRONT_MODIFIERS];
    if (!frontModifiers) {
      frontModifiers = [];
    }
    if (typeof newFrontModifier === "string") {
      frontModifiers.push(
        StringElement.fromString(newFrontModifier, this.context),
      );
    } else {
      frontModifiers.push(newFrontModifier);
    }
    this.features[InternalFeature.FRONT_MODIFIERS] = frontModifiers;
  }

  setFrontModifier(newFrontModifier: NLGElement | string): void {
    delete this.features[InternalFeature.FRONT_MODIFIERS];
    this.addFrontModifier(newFrontModifier);
  }

  addPreModifier(newPreModifier: NLGElement | string): void {
    let preModifiers = this.features[InternalFeature.PREMODIFIERS];
    if (!preModifiers) {
      preModifiers = [];
    }

    if (typeof newPreModifier === "string") {
      preModifiers.push(StringElement.fromString(newPreModifier, this.context));
    } else {
      preModifiers.push(newPreModifier);
    }
    this.features[InternalFeature.PREMODIFIERS] = preModifiers;
  }

  setPreModifier(newPreModifier: NLGElement | string): void {
    delete this.features[InternalFeature.PREMODIFIERS];
    this.addPreModifier(newPreModifier);
  }

  addModifier(modifier: NLGElement | string): void {
    this.addPreModifier(modifier);
  }

  getPreModifiers(): NLGElement[] {
    return this.features[InternalFeature.PREMODIFIERS] ?? [];
  }

  getPostModifiers(): NLGElement[] {
    return this.features[InternalFeature.POSTMODIFIERS] ?? [];
  }

  getFrontModifiers(): NLGElement[] {
    return this.features[InternalFeature.FRONT_MODIFIERS] ?? [];
  }

  override printTree(indent?: string): string {
    const thisIndent = indent === undefined ? " |-" : indent + " |-";
    const childIndent = indent === undefined ? " | " : indent + " | ";
    const lastIndent = indent === undefined ? " \\-" : indent + " \\-";
    const lastChildIndent = indent === undefined ? "   " : indent + "   ";
    const print = [];
    print.push(
      `PhraseElement: category=${this.category?.toString()}, features={`,
    );

    const features = this.getAllFeatures();
    for (const [key, value] of Object.entries(features)) {
      print.push(`${key}=${value?.toString()} `);
    }
    print.push("}\n");
    const children = this.getChildren();
    const length = children.length - 1;

    for (let index = 0; index < length; index++) {
      print.push(`${thisIndent}${children[index]?.printTree(childIndent)}`);
    }
    if (length >= 0) {
      print.push(
        `${lastIndent}${children[length]?.printTree(lastChildIndent)}`,
      );
    }
    return print.join("");
  }

  clearComplements(): void {
    delete this.features[InternalFeature.COMPLEMENTS];
  }
}
