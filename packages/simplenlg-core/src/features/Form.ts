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

export const FormValues = [
  "BARE_INFINITIVE",
  "GERUND",
  "IMPERATIVE",
  "INFINITIVE",
  "NORMAL",
  "PAST_PARTICIPLE",
  "PRESENT_PARTICIPLE",
] as const;
export type FormValue = (typeof FormValues)[number];

export class Form extends JLikeEnum<FormValue> {
  /**
   * The bare infinitive is the verb's base form without "to".
   * Example: "walk" in "I can walk home."
   */
  static readonly BARE_INFINITIVE = new Form("BARE_INFINITIVE");

  /**
   * A gerund is a form that functions as a noun, typically ending in "-ing".
   * Example: "running" in "Running is fun."
   */
  static readonly GERUND = new Form("GERUND");

  /**
   * An imperative expresses a command or instruction.
   * Example: "Stop" in "Stop talking."
   */
  static readonly IMPERATIVE = new Form("IMPERATIVE");

  /**
   * An infinitive typically uses "to" plus the verb's base form.
   * Example: "to eat" in "I want to eat now."
   */
  static readonly INFINITIVE = new Form("INFINITIVE");

  /**
   * A normal (finite) form of the verb, often conjugated to match tense/subject.
   * Example: "goes" in "He goes to school."
   */
  static readonly NORMAL = new Form("NORMAL");

  /**
   * A past participle is used to form perfect tenses and passive voice in English.
   * Example: "eaten" in "I have eaten breakfast."
   */
  static readonly PAST_PARTICIPLE = new Form("PAST_PARTICIPLE");

  /**
   * A present participle ends in "-ing" and is used in continuous tenses.
   * Example: "eating" in "I am eating dinner."
   */
  static readonly PRESENT_PARTICIPLE = new Form("PRESENT_PARTICIPLE");
}
