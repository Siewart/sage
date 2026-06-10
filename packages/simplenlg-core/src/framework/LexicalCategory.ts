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

export const LexicalCategoryValues = [
  "ANY",
  "SYMBOL",
  "NOUN",
  "ADJECTIVE",
  "ADVERB",
  "VERB",
  "DETERMINER",
  "PRONOUN",
  "CONJUNCTION",
  "PREPOSITION",
  "COMPLEMENTISER",
  "MODAL",
  "AUXILIARY",
] as const;

export type LexicalCategoryValue = (typeof LexicalCategoryValues)[number];

export class LexicalCategory extends ElementCategory {
  static readonly ANY = new LexicalCategory("ANY");
  static readonly SYMBOL = new LexicalCategory("SYMBOL");
  static readonly NOUN = new LexicalCategory("NOUN");
  static readonly ADJECTIVE = new LexicalCategory("ADJECTIVE");
  static readonly ADVERB = new LexicalCategory("ADVERB");
  static readonly VERB = new LexicalCategory("VERB");
  static readonly DETERMINER = new LexicalCategory("DETERMINER");
  static readonly PRONOUN = new LexicalCategory("PRONOUN");
  static readonly CONJUNCTION = new LexicalCategory("CONJUNCTION");
  static readonly PREPOSITION = new LexicalCategory("PREPOSITION");
  static readonly COMPLEMENTISER = new LexicalCategory("COMPLEMENTISER");
  static readonly MODAL = new LexicalCategory("MODAL");
  static readonly AUXILIARY = new LexicalCategory("AUXILIARY");

  protected constructor(type: LexicalCategoryValue) {
    super(type);
  }

  static fromLexicalValue<T extends string>(
    value: T,
  ): LexicalCategory | undefined {
    return this.fromValue(value) as LexicalCategory | undefined;
  }
}
