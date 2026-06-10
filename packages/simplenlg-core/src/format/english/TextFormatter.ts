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

import { NLGContext } from "../../factory/NLGContext.js";
import { DocumentCategory } from "../../framework/DocumentCategory.js";
import { NLGElement } from "../../framework/NLGElement.js";
import { NLGModule } from "../../framework/NLGModule.js";
import { StringElement } from "../../framework/StringElement.js";
import { DocumentElement } from "../../framework/DocumentElement.js";
import { ListElement } from "../../framework/ListElement.js";
import { CoordinatedPhraseElement } from "../../framework/CoordinatedPhraseElement.js";
import { NumberedPrefix } from "./NumberedPrefix.js";

export class TextFormatter extends NLGModule {
  private static numberedPrefix = NumberedPrefix.create();

  static create(context: NLGContext): TextFormatter {
    return new TextFormatter(context);
  }

  private constructor(context: NLGContext) {
    super(context);
  }

  override realise(element: NLGElement): NLGElement {
    let realisedComponent: NLGElement | undefined;
    let realisation = "";

    if (element) {
      const category = element.category;
      const components = element.getChildren();

      if (element instanceof StringElement) {
        realisation = element.realisation ?? "";
      } else if (category instanceof DocumentCategory) {
        const title =
          element instanceof DocumentElement ? element.title : undefined;
        switch (category) {
          case DocumentCategory.DOCUMENT:
            realisation = this.appendTitle(realisation, title, 2);
            realisation = this.realiseSubComponents(realisation, components);
            break;

          case DocumentCategory.SECTION:
            realisation = this.appendTitle(realisation, title, 1);
            realisation = this.realiseSubComponents(realisation, components);
            break;

          case DocumentCategory.LIST:
            realisation = this.realiseSubComponents(realisation, components);
            break;

          case DocumentCategory.ENUMERATED_LIST:
            TextFormatter.numberedPrefix.upALevel();
            if (title) {
              realisation += title + "\n";
            }

            if (components?.length > 0) {
              components.forEach((component, index) => {
                if (
                  index > 0 &&
                  realisedComponent?.realisation &&
                  !realisedComponent.realisation.endsWith("\n")
                ) {
                  realisation += " ";
                }
                if (
                  component.parent?.category ===
                    DocumentCategory.ENUMERATED_LIST &&
                  index > 0
                ) {
                  TextFormatter.numberedPrefix.increment();
                }
                if (component) {
                  realisedComponent = this.realise(component);
                  if (realisedComponent) {
                    realisation += realisedComponent.realisation ?? "";
                  }
                }
              });
            }

            TextFormatter.numberedPrefix.downALevel();
            break;

          case DocumentCategory.PARAGRAPH:
            if (components?.length > 0) {
              components.forEach((component, index) => {
                if (index > 0 && realisedComponent?.realisation) {
                  realisation += " ";
                }
                if (component) {
                  realisedComponent = this.realise(component);
                  if (realisedComponent) {
                    realisation += realisedComponent.realisation ?? "";
                  }
                }
              });
            }
            realisation += "\n\n";
            break;

          case DocumentCategory.SENTENCE:
            realisation += element.realisation ?? "";
            break;

          case DocumentCategory.LIST_ITEM:
            if (element.parent) {
              if (element.parent.category === DocumentCategory.LIST) {
                realisation += " * ";
              } else if (
                element.parent.category === DocumentCategory.ENUMERATED_LIST
              ) {
                realisation += `${TextFormatter.numberedPrefix.prefix} - `;
              }
            }

            for (const component of components) {
              realisedComponent = this.realise(component);
              if (realisedComponent) {
                realisation += realisedComponent.realisation ?? "";
                if (components.indexOf(component) < components.length - 1) {
                  realisation += " ";
                }
              }
            }
            realisation += "\n";
            break;
        }
      } else if (
        element instanceof ListElement ||
        element instanceof CoordinatedPhraseElement
      ) {
        for (const component of components) {
          realisedComponent = this.realise(component);
          if (realisedComponent) {
            realisation += `${realisedComponent.realisation} `;
          }
        }
      }
    }

    return StringElement.fromString(realisation, this.context);
  }

  private realiseSubComponents(
    realisation: string,
    components: NLGElement[],
  ): string {
    for (const component of components) {
      const realisedComponent = this.realise(component);
      if (realisedComponent) {
        realisation += realisedComponent.realisation ?? "";
      }
    }
    return realisation;
  }

  private appendTitle(
    realisation: string,
    title: string | undefined,
    numberOfLineBreaksAfterTitle: number,
  ): string {
    if (title) {
      realisation += title;
      for (let i = 0; i < numberOfLineBreaksAfterTitle; i++) {
        realisation += "\n";
      }
    }
    return realisation;
  }

  override realiseAll(elements: NLGElement[]): NLGElement[] {
    return elements?.map((element) => this.realise(element)) ?? [];
  }
}
