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

export const InitialisedCategoryValues = [
  "INITIALISED_COORDINATED_PHRASE",
] as const;

export type InitialisedCategoryValue =
  (typeof InitialisedCategoryValues)[number];

export class InitialisedCategory extends ElementCategory {
  static readonly INITIALISED_COORDINATED_PHRASE = new InitialisedCategory(
    "INITIALISED_COORDINATED_PHRASE",
  );
  protected constructor(type: InitialisedCategoryValue) {
    super(type);
  }
}
