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
import { Form } from "./Form.js";
import { InterrogativeType } from "./InterrogativeType.js";
import { NumberAgreement } from "./NumberAgreement.js";
import { Person } from "./Person.js";
import { Tense } from "./Tense.js";
import { ConjunctionType } from "./ConjunctionType.js";

export const Feature = {
  ADJECTIVE_ORDERING: "adjective_ordering",
  AGGREGATE_AUXILIARY: "aggregate_auxiliary",
  COMPLEMENTISER: "complementiser",
  CONJUNCTION: "conjunction",
  CONJUNCTION_TYPE: "conjunction_type",
  APPOSITIVE: "appositive",
  CUE_PHRASE: "cue_phrase",
  ELIDED: "elided",
  EXCLAMATORY: "exclamatory",
  FORM: "form",
  INTERROGATIVE_TYPE: "interrogative_type",
  IS_COMPARATIVE: "is_comparative",
  IS_SUPERLATIVE: "is_superlative",
  MODAL: "modal",
  NEGATED: "negated",
  NUMBER: "number",
  PARTICLE: "particle",
  PASSIVE: "passive",
  PERFECT: "perfect",
  PERSON: "person",
  POSSESSIVE: "possessive",
  PRONOMINAL: "pronominal",
  PROGRESSIVE: "progressive",
  RAISE_SPECIFIER: "raise_specifier",
  SUPPRESS_GENITIVE_IN_GERUND: "suppress_genitive_in_gerund",
  SUPRESSED_COMPLEMENTISER: "suppressed_complementiser",
  TENSE: "tense",
} as const;

export type FeatureSet = {
  [Feature.ADJECTIVE_ORDERING]: boolean;
  [Feature.AGGREGATE_AUXILIARY]: boolean;
  [Feature.COMPLEMENTISER]: NLGElement;
  [Feature.CONJUNCTION]: string;
  [Feature.CONJUNCTION_TYPE]: ConjunctionType;
  [Feature.APPOSITIVE]: boolean;
  [Feature.CUE_PHRASE]: NLGElement;
  [Feature.ELIDED]: boolean;
  [Feature.EXCLAMATORY]: boolean;
  [Feature.FORM]: Form;
  [Feature.INTERROGATIVE_TYPE]: InterrogativeType;
  [Feature.IS_COMPARATIVE]: boolean;
  [Feature.IS_SUPERLATIVE]: boolean;
  [Feature.MODAL]: string;
  [Feature.NEGATED]: boolean;
  [Feature.NUMBER]: NumberAgreement;
  [Feature.PARTICLE]: string;
  [Feature.PASSIVE]: boolean;
  [Feature.PERFECT]: boolean;
  [Feature.PERSON]: Person;
  [Feature.POSSESSIVE]: boolean;
  [Feature.PRONOMINAL]: boolean;
  [Feature.PROGRESSIVE]: boolean;
  [Feature.RAISE_SPECIFIER]: boolean;
  [Feature.SUPPRESS_GENITIVE_IN_GERUND]: boolean;
  [Feature.SUPRESSED_COMPLEMENTISER]: boolean;
  [Feature.TENSE]: Tense;
};
