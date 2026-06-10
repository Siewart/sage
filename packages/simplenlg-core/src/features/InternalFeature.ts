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

import { NLGElement } from "../framework/NLGElement.js";
import { ClauseStatus } from "./ClauseStatus.js";
import { DiscourseFunction } from "./DiscourseFunction.js";

export const InternalFeature = {
  ACRONYM: "acronym",
  BASE_WORD: "base_word",
  CLAUSE_STATUS: "clause_status",
  COMPLEMENTS: "complements",
  COMPONENTS: "components",
  COORDINATES: "coordinates",
  DISCOURSE_FUNCTION: "discourse_function",
  NON_MORPH: "non_morph",
  FRONT_MODIFIERS: "front_modifiers",
  HEAD: "head",
  IGNORE_MODAL: "ignore_modal",
  INTERROGATIVE: "interrogative",
  POSTMODIFIERS: "postmodifiers",
  PREMODIFIERS: "premodifiers",
  RAISED: "raised",
  REALISE_AUXILIARY: "realise_auxiliary",
  SPECIFIER: "specifier",
  SUBJECTS: "subjects",
  VERB_PHRASE: "verb_phrase",
} as const;

export type InternalFeatureSet = {
  [InternalFeature.ACRONYM]: boolean;
  [InternalFeature.BASE_WORD]: NLGElement;
  [InternalFeature.CLAUSE_STATUS]: ClauseStatus;
  [InternalFeature.COMPLEMENTS]: NLGElement[];
  [InternalFeature.COMPONENTS]: NLGElement[];
  [InternalFeature.COORDINATES]: NLGElement[];
  [InternalFeature.DISCOURSE_FUNCTION]: DiscourseFunction;
  [InternalFeature.NON_MORPH]: boolean;
  [InternalFeature.FRONT_MODIFIERS]: NLGElement[];
  [InternalFeature.HEAD]: NLGElement;
  [InternalFeature.IGNORE_MODAL]: boolean;
  [InternalFeature.INTERROGATIVE]: boolean;
  [InternalFeature.POSTMODIFIERS]: NLGElement[];
  [InternalFeature.PREMODIFIERS]: NLGElement[];
  [InternalFeature.RAISED]: boolean;
  [InternalFeature.REALISE_AUXILIARY]: boolean;
  [InternalFeature.SPECIFIER]: NLGElement;
  [InternalFeature.SUBJECTS]: NLGElement[];
  [InternalFeature.VERB_PHRASE]: NLGElement;
};
