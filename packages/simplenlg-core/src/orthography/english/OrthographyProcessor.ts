/*
 * The contents of this file are subject to the Mozilla Public License
 * Version 2.0 (the "License"); you may not use this file except in
 * compliance with the License. You can obtain a copy of the License at
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
 * Contributor(s): Ehud Reiter, Albert Gatt, Dave Westwater, Roman Kutlak,
 * Margaret Mitchell, and Saad Mahamood.
 *
 * TypeScript conversion: Siewart van Wingerden (University of Twente)
 */

import { NLGContext } from "../../factory/NLGContext.js";
import { DiscourseFunction } from "../../features/DiscourseFunction.js";
import { Feature } from "../../features/Feature.js";
import { InternalFeature } from "../../features/InternalFeature.js";
import { CoordinatedPhraseElement } from "../../framework/CoordinatedPhraseElement.js";
import { DocumentCategory } from "../../framework/DocumentCategory.js";
import { DocumentElement } from "../../framework/DocumentElement.js";
import { NLGElement } from "../../framework/NLGElement.js";
import { ListElement } from "../../framework/ListElement.js";
import { NLGModule } from "../../framework/NLGModule.js";
import { StringElement } from "../../framework/StringElement.js";

export class OrthographyProcessor extends NLGModule {
  private _commaSepPremodifiers = true;
  private _commaSepCuephrase = false;

  // Static creator
  public static create(context: NLGContext): OrthographyProcessor {
    return new OrthographyProcessor(context);
  }

  private constructor(context: NLGContext) {
    super(context);
    this._commaSepPremodifiers = true;
    this._commaSepCuephrase = false;
  }

  get commaSepPremodifiers(): boolean {
    return this._commaSepPremodifiers;
  }

  set commaSepPremodifiers(value: boolean) {
    this._commaSepPremodifiers = value;
  }

  get commaSepCuephrase(): boolean {
    return this._commaSepCuephrase;
  }

  set commaSepCuephrase(value: boolean) {
    this._commaSepCuephrase = value;
  }

  public override realise(element: NLGElement): NLGElement {
    let realisedElement: NLGElement;
    let func: DiscourseFunction | undefined; // the element's discourse function

    // get the element's function first
    if (element instanceof ListElement) {
      const children = element.getChildren();
      if (children.length > 0 && children[0] !== undefined) {
        const firstChild = children[0];
        func = firstChild.features[InternalFeature.DISCOURSE_FUNCTION];
      }
    } else {
      func = element.features[InternalFeature.DISCOURSE_FUNCTION];
    }

    const category = element.category;

    if (
      category instanceof DocumentCategory &&
      element instanceof DocumentElement
    ) {
      const components = element.components || [];
      let realisation: NLGElement | undefined = undefined;
      switch (category) {
        case DocumentCategory.SENTENCE:
          realisation = this.realiseSentence(components, element);
          break;

        case DocumentCategory.LIST_ITEM:
          if (components !== undefined && components.length > 0) {
            realisation = ListElement.fromComponents(
              this.realiseAll(components),
              category,
              this.context,
            );
            realisation.parent = element.parent;
          }
          break;

        default:
          element.setComponents(this.realiseAll(components));
          realisation = element;
      }
      realisedElement = realisation ?? element;
    } else if (element instanceof ListElement) {
      let buffer: string = "";

      if (DiscourseFunction.PRE_MODIFIER === func) {
        const allAppositives = element
          .getChildren()
          .every((child) => child.features[Feature.APPOSITIVE] ?? false);
        // TODO (copied from Java): unless this is the end of the sentence

        if (allAppositives) {
          buffer += ", ";
        }
        buffer = this.realiseList(
          buffer,
          element.getChildren(),
          this._commaSepPremodifiers ? "," : "",
        );
        if (allAppositives) {
          buffer += ", ";
        }
      } else if (DiscourseFunction.POST_MODIFIER === func) {
        const postmods = element.getChildren();
        postmods.forEach((postmod) => {
          if (postmod.features[Feature.APPOSITIVE]) {
            buffer += ", ";
            buffer += this.realise(postmod)?.realisation || "";
            buffer += ", ";
          } else {
            buffer += this.realise(postmod)?.realisation || "";
            if (
              postmod instanceof ListElement ||
              (postmod.realisation !== undefined && postmod.realisation !== "")
            ) {
              buffer += " ";
            }
          }
        });
      } else if (
        (DiscourseFunction.CUE_PHRASE === func ||
          DiscourseFunction.FRONT_MODIFIER === func) &&
        this._commaSepCuephrase
      ) {
        buffer = this.realiseList(buffer, element.getChildren(), ",");
      } else {
        buffer = this.realiseList(buffer, element.getChildren(), "");
      }

      realisedElement = StringElement.fromString(buffer, this.context);
    } else if (element instanceof CoordinatedPhraseElement) {
      realisedElement = this.realiseCoordinatedPhrase(element.getChildren());
    } else {
      realisedElement = element;
    }

    realisedElement.category = category;

    if (
      (DiscourseFunction.CUE_PHRASE === func ||
        DiscourseFunction.FRONT_MODIFIER === func) &&
      this._commaSepCuephrase
    ) {
      let realisation = realisedElement.realisation;

      if (!realisation?.endsWith(",")) {
        realisation = realisation + ",";
      }

      realisedElement.realisation = realisation;
    }

    this.removePunctSpace(realisedElement);
    return realisedElement;
  }

  private removePunctSpace(realisedElement: NLGElement): void {
    let realisation = realisedElement?.realisation;

    if (realisation !== undefined) {
      realisation = realisation.replace(/ ,/g, ",");
      realisation = realisation.replace(/,,+/g, ",");
      realisedElement.realisation = realisation;
    }
  }

  private realiseSentence(
    components: NLGElement[],
    element: DocumentElement,
  ): NLGElement | undefined {
    let realisedElement: NLGElement | undefined = undefined;
    if (components[0] !== undefined && components.length > 0) {
      let realisation: string = "";
      realisation = this.realiseList(realisation, components, "");
      realisation = this.stripLeadingCommas(realisation);
      realisation = this.capitaliseFirstLetter(realisation);
      realisation = this.terminateSentence(
        realisation,
        element.features[InternalFeature.INTERROGATIVE] ?? false,
        element.features[Feature.EXCLAMATORY] ?? false,
      );

      element.clearComponents();
      element.realisation = realisation;
      realisedElement = element;
    }

    return realisedElement;
  }

  private terminateSentence(
    realisation: string,
    interrogative: boolean,
    exclamatory: boolean,
  ): string {
    const character = realisation[realisation.length - 1];
    if (character !== "." && character !== "?") {
      if (interrogative) {
        realisation += "?";
      } else if (exclamatory) {
        realisation += "!";
      } else {
        realisation += ".";
      }
    }
    return realisation;
  }

  private stripLeadingCommas(realisation: string): string {
    const character = realisation[0];
    if (character === " " || character === ",") {
      realisation = realisation.substring(1);
      realisation = this.stripLeadingCommas(realisation);
    }
    return realisation;
  }

  private capitaliseFirstLetter(realisation: string): string {
    if (realisation[0] !== undefined) {
      // The original Java code only supports characters from a-z, but we use a builtin that is more general
      realisation = realisation.charAt(0).toUpperCase() + realisation.slice(1);
    }
    return realisation;
  }

  public override realiseAll(elements: NLGElement[]): NLGElement[] {
    const realisedList: NLGElement[] = [];

    if (elements !== undefined && elements.length > 0) {
      for (const eachElement of elements) {
        if (eachElement instanceof DocumentElement) {
          realisedList.push(this.realise(eachElement));
        } else {
          realisedList.push(eachElement);
        }
      }
    }
    return realisedList;
  }

  private realiseList(
    realisation: string,
    components: NLGElement[],
    listSeparator: string,
  ): string {
    components.forEach((thisElement, i) => {
      const realisedChild = this.realise(thisElement);
      const childRealisation = realisedChild?.realisation;

      if (
        childRealisation !== undefined &&
        childRealisation.length > 0 &&
        !/^[\s\n]+$/.test(childRealisation)
      ) {
        realisation += childRealisation;

        if (components.length > 1 && i < components.length - 1) {
          realisation += listSeparator;
        }

        realisation += " ";
      }
    });

    if (realisation.length > 0) {
      realisation = realisation.slice(0, -1);
    }
    return realisation;
  }

  private realiseCoordinatedPhrase(components: NLGElement[]): NLGElement {
    let realisation: string = "";

    const length = components.length;
    components.forEach((element, index) => {
      if (
        index < length - 2 &&
        DiscourseFunction.CONJUNCTION ===
          element.features[InternalFeature.DISCOURSE_FUNCTION]
      ) {
        realisation += ", ";
      } else {
        const realisedChild = this.realise(element);
        realisation += realisedChild?.realisation || "";
        realisation += " ";
      }
    });
    realisation.slice(0, -1);
    return StringElement.fromString(
      realisation.replace(" ,", ","),
      this.context,
    );
  }
}
