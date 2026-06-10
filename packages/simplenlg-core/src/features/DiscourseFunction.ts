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

export const DiscourseFunctionValues = [
  "AUXILIARY",
  "COMPLEMENT",
  "CONJUNCTION",
  "CUE_PHRASE",
  "FRONT_MODIFIER",
  "HEAD",
  "INDIRECT_OBJECT",
  "OBJECT",
  "PRE_MODIFIER",
  "POST_MODIFIER",
  "SPECIFIER",
  "SUBJECT",
  "VERB_PHRASE",
] as const;
export type DiscourseFunctionValue = (typeof DiscourseFunctionValues)[number];

export class DiscourseFunction extends JLikeEnum<DiscourseFunctionValue> {
  static readonly AUXILIARY = new DiscourseFunction("AUXILIARY");
  static readonly COMPLEMENT = new DiscourseFunction("COMPLEMENT");
  static readonly CONJUNCTION = new DiscourseFunction("CONJUNCTION");
  static readonly CUE_PHRASE = new DiscourseFunction("CUE_PHRASE");
  static readonly FRONT_MODIFIER = new DiscourseFunction("FRONT_MODIFIER");
  static readonly HEAD = new DiscourseFunction("HEAD");
  static readonly INDIRECT_OBJECT = new DiscourseFunction("INDIRECT_OBJECT");
  static readonly OBJECT = new DiscourseFunction("OBJECT");
  static readonly PRE_MODIFIER = new DiscourseFunction("PRE_MODIFIER");
  static readonly POST_MODIFIER = new DiscourseFunction("POST_MODIFIER");
  static readonly SPECIFIER = new DiscourseFunction("SPECIFIER");
  static readonly SUBJECT = new DiscourseFunction("SUBJECT");
  static readonly VERB_PHRASE = new DiscourseFunction("VERB_PHRASE");
}
