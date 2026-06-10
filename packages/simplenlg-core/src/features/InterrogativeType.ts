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

export const InterrogativeTypeValues = [
  "HOW",
  "HOW_PREDICATE",
  "WHAT_OBJECT",
  "WHAT_SUBJECT",
  "WHERE",
  "WHO_INDIRECT_OBJECT",
  "WHO_OBJECT",
  "WHO_SUBJECT",
  "WHY",
  "YES_NO",
  "HOW_MANY",
] as const;

export type InterrogativeTypeValue = (typeof InterrogativeTypeValues)[number];

const InterrogativeTypeString: Record<InterrogativeTypeValue, string> = {
  HOW: "how",
  HOW_PREDICATE: "how",
  WHAT_OBJECT: "what",
  WHAT_SUBJECT: "what",
  WHERE: "where",
  WHO_INDIRECT_OBJECT: "who",
  WHO_OBJECT: "who",
  WHO_SUBJECT: "who",
  WHY: "why",
  YES_NO: "yes/no",
  HOW_MANY: "how many",
} as const;

export class InterrogativeType extends JLikeEnum<InterrogativeTypeValue> {
  static readonly HOW = new InterrogativeType("HOW");
  static readonly HOW_PREDICATE = new InterrogativeType("HOW_PREDICATE");
  static readonly WHAT_OBJECT = new InterrogativeType("WHAT_OBJECT");
  static readonly WHAT_SUBJECT = new InterrogativeType("WHAT_SUBJECT");
  static readonly WHERE = new InterrogativeType("WHERE");
  static readonly WHO_INDIRECT_OBJECT = new InterrogativeType(
    "WHO_INDIRECT_OBJECT",
  );
  static readonly WHO_OBJECT = new InterrogativeType("WHO_OBJECT");
  static readonly WHO_SUBJECT = new InterrogativeType("WHO_SUBJECT");
  static readonly WHY = new InterrogativeType("WHY");
  static readonly YES_NO = new InterrogativeType("YES_NO");
  static readonly HOW_MANY = new InterrogativeType("HOW_MANY");

  static readonly isObject = (type: unknown): boolean =>
    type === InterrogativeType.WHO_OBJECT ||
    type === InterrogativeType.WHAT_OBJECT;
  static readonly isIndirectObject = (type: unknown): boolean =>
    type === InterrogativeType.WHO_INDIRECT_OBJECT;
  getString = (): string => InterrogativeTypeString?.[this.value];

  static fromInterrogativeValue = <T extends string>(
    type: T,
  ): InterrogativeType | undefined =>
    this.fromValue(type) as InterrogativeType | undefined;
}
