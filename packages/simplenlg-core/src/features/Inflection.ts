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

import { JLikeEnum } from "../utils.js";

export const InflectionValues = [
  "REGULAR",
  "IRREGULAR",
  "REGULAR_DOUBLE",
  "GRECO_LATIN_REGULAR",
  "UNCOUNT",
  "INVARIANT",
] as const;

export type InflectionValue = (typeof InflectionValues)[number];
export const InflectionCodeValues = [
  "reg",
  "irreg",
  "regd",
  "glreg",
  "uncount",
  "noncount",
  "groupuncount",
  "inv",
] as const;
export type InflectionCode = (typeof InflectionCodeValues)[number];
export const InflCode: Record<InflectionValue, InflectionCode[]> = {
  REGULAR: ["reg"],
  IRREGULAR: ["irreg"],
  REGULAR_DOUBLE: ["regd"],
  GRECO_LATIN_REGULAR: ["glreg"],
  UNCOUNT: ["uncount", "noncount", "groupuncount"],
  INVARIANT: ["inv"],
} as const;

export class Inflection extends JLikeEnum<InflectionValue> {
  static readonly REGULAR = new Inflection("REGULAR");
  static readonly IRREGULAR = new Inflection("IRREGULAR");
  static readonly REGULAR_DOUBLE = new Inflection("REGULAR_DOUBLE");
  static readonly GRECO_LATIN_REGULAR = new Inflection("GRECO_LATIN_REGULAR");
  static readonly UNCOUNT = new Inflection("UNCOUNT");
  static readonly INVARIANT = new Inflection("INVARIANT");

  static readonly getInflCode = (
    codeStr: string | undefined,
  ): Inflection | undefined => {
    const code = codeStr?.toLowerCase().trim() ?? undefined;
    if (code === undefined) return undefined;
    if (InflCode.REGULAR.includes(code as InflectionCode)) {
      return Inflection.REGULAR;
    } else if (InflCode.IRREGULAR.includes(code as InflectionCode)) {
      return Inflection.IRREGULAR;
    } else if (InflCode.REGULAR_DOUBLE.includes(code as InflectionCode)) {
      return Inflection.REGULAR_DOUBLE;
    } else if (InflCode.GRECO_LATIN_REGULAR.includes(code as InflectionCode)) {
      return Inflection.GRECO_LATIN_REGULAR;
    } else if (InflCode.UNCOUNT.includes(code as InflectionCode)) {
      return Inflection.UNCOUNT;
    } else if (InflCode.INVARIANT.includes(code as InflectionCode)) {
      return Inflection.INVARIANT;
    }
    return undefined;
  };

  static fromInflectionValue<T extends string>(
    value: T,
  ): Inflection | undefined {
    return this.fromValue(value) as Inflection | undefined;
  }
}
