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

export const RealisedCategoryValues = [
  "REALISED_COORDINATED_PHRASE",
  "REALISED_VERB_PHRASE",
  "REALISED_SUBJECTS",
  "REALISED_CLAUSE",
  "REALISED_LIST",
  "REALISED_UNKNOWN_COMPLEMENT",
  "REALISED_DIRECT_COMPLEMENT",
  "REALISED_INDIRECT_COMPLEMENT",
] as const;

export type RealisedCategoryValue = (typeof RealisedCategoryValues)[number];

export class RealisedCategory extends ElementCategory {
  static readonly REALISED_COORDINATED_PHRASE = new RealisedCategory(
    "REALISED_COORDINATED_PHRASE",
  );
  static readonly REALISED_VERB_PHRASE = new RealisedCategory(
    "REALISED_VERB_PHRASE",
  );
  static readonly REALISED_SUBJECTS = new RealisedCategory("REALISED_SUBJECTS");
  static readonly REALISED_CLAUSE = new RealisedCategory("REALISED_CLAUSE");
  static readonly REALISED_LIST = new RealisedCategory("REALISED_LIST");
  static readonly REALISED_UNKNOWN_COMPLEMENT = new RealisedCategory(
    "REALISED_UNKNOWN_COMPLEMENT",
  );
  static readonly REALISED_DIRECT_COMPLEMENT = new RealisedCategory(
    "REALISED_DIRECT_COMPLEMENT",
  );
  static readonly REALISED_INDIRECT_COMPLEMENT = new RealisedCategory(
    "REALISED_INDIRECT_COMPLEMENT",
  );
  protected constructor(type: RealisedCategoryValue) {
    super(type);
  }
}
