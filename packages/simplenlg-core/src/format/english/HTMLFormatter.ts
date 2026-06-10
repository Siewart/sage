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

export class HTMLFormatter extends NLGModule {
  static create(context: NLGContext): HTMLFormatter {
    return new HTMLFormatter(context);
  }

  private constructor(context: NLGContext) {
    super(context);
  }

  override realise(element: NLGElement): NLGElement {
    let realisedComponent: NLGElement | undefined;
    let realisation = "";

    const category = element.category;
    const components = element.getChildren();

    if (element instanceof StringElement) {
      realisation = element.realisation;
    } else if (category instanceof DocumentCategory) {
      switch (category) {
        case DocumentCategory.DOCUMENT: {
          const docTitle =
            element instanceof DocumentElement ? element.title : undefined;
          if (docTitle) {
            realisation += `<h1>${docTitle}</h1>`;
          }

          for (const component of components) {
            realisedComponent = this.realise(component);
            if (realisedComponent) {
              realisation += realisedComponent.realisation ?? "";
            }
          }
          break;
        }

        case DocumentCategory.SECTION: {
          const secTitle =
            element instanceof DocumentElement ? element.title : undefined;
          if (secTitle) {
            realisation += `<h2>${secTitle}</h2>`;
          }

          for (const component of components) {
            realisedComponent = this.realise(component);
            if (realisedComponent) {
              realisation += realisedComponent.realisation ?? "";
            }
          }
          break;
        }
        case DocumentCategory.LIST: {
          realisation += "<ul>";
          for (const component of components) {
            realisedComponent = this.realise(component);
            if (realisedComponent) {
              realisation += realisedComponent.realisation ?? "";
            }
          }
          realisation += "</ul>";
          break;
        }
        case DocumentCategory.ENUMERATED_LIST: {
          realisation += "<ol>";
          for (const component of components) {
            realisedComponent = this.realise(component);
            if (realisedComponent) {
              realisation += realisedComponent.realisation ?? "";
            }
          }
          realisation += "</ol>";
          break;
        }
        case DocumentCategory.PARAGRAPH: {
          realisation += "<p>";
          components.forEach((component, index) => {
            if (index > 0 && realisedComponent) {
              realisation += " ";
            }
            realisedComponent = this.realise(component);
            if (realisedComponent) {
              realisation += realisedComponent.realisation ?? "";
            }
          });
          realisation += "</p>";
          break;
        }
        case DocumentCategory.SENTENCE: {
          realisation += element.realisation ?? "";
          break;
        }
        case DocumentCategory.LIST_ITEM:
          {
            realisation += "<li>";
            for (const component of components) {
              realisedComponent = this.realise(component);
              if (realisedComponent) {
                realisation += realisedComponent.realisation ?? "";
                if (components.indexOf(component) < components.length - 1) {
                  realisation += " ";
                }
              }
            }
            realisation += "</li>";
          }
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

    return StringElement.fromString(realisation, this.context);
  }

  override realiseAll(elements: NLGElement[]): NLGElement[] {
    return elements.map((element) => this.realise(element));
  }
}
