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
import { cloneInto } from "../utils.js";
import { BaseFeatureSet } from "./NLGElement.js";
import { NLGElement } from "./NLGElement.js";
import { PhraseCategory } from "./PhraseCategory.js";

export class StringElement extends NLGElement {
  override defaultValues: {
    [Feature.ELIDED]: boolean;
  };

  readonly features: typeof this.defaultValues & Partial<BaseFeatureSet>;

  override resetFeatures(): void {
    cloneInto(this.defaultValues, this.features, true);
  }

  private constructor(category: PhraseCategory, context: NLGContext) {
    super(category, context);
    this.defaultValues = { [Feature.ELIDED]: false };
    this.features = { ...this.defaultValues };
  }

  public static fromString(value: string, context: NLGContext): StringElement {
    const element = new StringElement(PhraseCategory.CANNED_TEXT, context);
    element.realisation = value;
    return element;
  }

  public override getChildren(): NLGElement[] {
    return [];
  }

  public override toString(): string {
    return this.realisation;
  }

  public override equals(o: unknown): boolean {
    return (
      super.equals(o) && o instanceof StringElement && this.realisationsMatch(o)
    );
  }

  private realisationsMatch(o: StringElement): boolean {
    if (this.realisation === undefined) {
      return false;
    } else {
      return this.realisation === o.realisation;
    }
  }

  public override printTree(_indent: string): string {
    let print = `StringElement: content="${this.realisation}"`;
    const features = this.getAllFeatures();

    if (features != null) {
      print += `, features=${features.toString()}`;
    }
    print += "\n";
    return print;
  }
}
