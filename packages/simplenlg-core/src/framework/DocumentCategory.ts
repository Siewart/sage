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

import { ElementCategory } from "./ElementCategory.js";

export const DocumentCategoryValues = [
  "DOCUMENT",
  "SECTION",
  "PARAGRAPH",
  "SENTENCE",
  "LIST",
  "ENUMERATED_LIST",
  "LIST_ITEM",
] as const;

export type DocumentCategoryValue = (typeof DocumentCategoryValues)[number];

export class DocumentCategory extends ElementCategory {
  static readonly DOCUMENT = new DocumentCategory("DOCUMENT");
  static readonly SECTION = new DocumentCategory("SECTION");
  static readonly PARAGRAPH = new DocumentCategory("PARAGRAPH");
  static readonly SENTENCE = new DocumentCategory("SENTENCE");
  static readonly LIST = new DocumentCategory("LIST");
  static readonly ENUMERATED_LIST = new DocumentCategory("ENUMERATED_LIST");
  static readonly LIST_ITEM = new DocumentCategory("LIST_ITEM");

  protected constructor(type: DocumentCategoryValue) {
    super(type);
  }

  hasSubPart = (elementCategory: ElementCategory | undefined): boolean => {
    if (elementCategory !== undefined) {
      if (elementCategory instanceof DocumentCategory) {
        switch (this.value) {
          case "DOCUMENT":
            return (
              !(elementCategory === DocumentCategory.DOCUMENT) &&
              !(elementCategory === DocumentCategory.LIST_ITEM)
            );
          case "SECTION":
            return (
              elementCategory === DocumentCategory.PARAGRAPH ||
              elementCategory === DocumentCategory.SECTION
            );
          case "PARAGRAPH":
            return (
              elementCategory === DocumentCategory.SENTENCE ||
              elementCategory === DocumentCategory.LIST
            );
          case "LIST":
            return elementCategory === DocumentCategory.LIST_ITEM;
          case "ENUMERATED_LIST":
            return elementCategory === DocumentCategory.LIST_ITEM;
          default:
            return false;
        }
      } else {
        return (
          this === DocumentCategory.SENTENCE ||
          this === DocumentCategory.LIST_ITEM
        );
      }
    }
    return false;
  };

  static fromDocumentValue<T extends string>(
    value: T,
  ): DocumentCategory | undefined {
    return this.fromValue(value) as DocumentCategory | undefined;
  }
}
