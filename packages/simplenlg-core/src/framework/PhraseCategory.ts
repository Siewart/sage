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

export const PhraseCategoryValues = [
  "CLAUSE",
  "ADJECTIVE_PHRASE",
  "ADVERB_PHRASE",
  "NOUN_PHRASE",
  "PREPOSITIONAL_PHRASE",
  "VERB_PHRASE",
  "CANNED_TEXT",
] as const;

export type PhraseCategoryValue = (typeof PhraseCategoryValues)[number];

export class PhraseCategory extends ElementCategory {
  static readonly CLAUSE = new PhraseCategory("CLAUSE");
  static readonly ADJECTIVE_PHRASE = new PhraseCategory("ADJECTIVE_PHRASE");
  static readonly ADVERB_PHRASE = new PhraseCategory("ADVERB_PHRASE");
  static readonly NOUN_PHRASE = new PhraseCategory("NOUN_PHRASE");
  static readonly PREPOSITIONAL_PHRASE = new PhraseCategory(
    "PREPOSITIONAL_PHRASE",
  );
  static readonly VERB_PHRASE = new PhraseCategory("VERB_PHRASE");
  static readonly CANNED_TEXT = new PhraseCategory("CANNED_TEXT");

  protected constructor(type: PhraseCategoryValue) {
    super(type);
  }
  static fromPhraseValue<T extends string>(
    value: T,
  ): PhraseCategory | undefined {
    return this.fromValue?.(value) as PhraseCategory | undefined;
  }
}
