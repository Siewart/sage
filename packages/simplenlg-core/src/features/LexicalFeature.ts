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

import { ElementCategory } from "../framework/ElementCategory.js";
import { LexicalCategory } from "../framework/LexicalCategory.js";
import { PhraseCategory } from "../framework/PhraseCategory.js";
import { Gender } from "./Gender.js";
import { Inflection } from "./Inflection.js";

export const LexicalFeature = {
  ACRONYM_OF: "acronym_of",
  ACRONYMS: "acronyms",
  DEFAULT_INFL: "default_infl",
  SPELL_VARS: "spell_vars",
  DEFAULT_SPELL: "default_spell",
  BASE_FORM: "base_form",
  CLASSIFYING: "classifying",
  COLOUR: "colour",
  COMPARATIVE: "comparative",
  DITRANSITIVE: "ditransitive",
  GENDER: "gender",
  INTENSIFIER: "intensifier",
  INTRANSITIVE: "intransitive",
  PAST: "past",
  PAST_PARTICIPLE: "pastParticiple",
  PLURAL: "plural",
  PREDICATIVE: "predicative",
  PRESENT_PARTICIPLE: "presentParticiple",
  PRESENT3S: "present3s",
  PROPER: "proper",
  QUALITATIVE: "qualitative",
  REFLEXIVE: "reflexive",
  SENTENCE_MODIFIER: "sentence_modifier",
  SUPERLATIVE: "superlative",
  TRANSITIVE: "transitive",
  VERB_MODIFIER: "verb_modifier",
  EXPLETIVE_SUBJECT: "expletive_subject",
} as const;

export const getInflectionalFeatures = (
  cat: ElementCategory,
): (typeof LexicalFeature)[keyof typeof LexicalFeature][] | undefined => {
  if (PhraseCategory.NOUN_PHRASE === cat || LexicalCategory.NOUN === cat)
    return [LexicalFeature.PLURAL];
  else if (PhraseCategory.VERB_PHRASE === cat || LexicalCategory.VERB === cat)
    return [
      LexicalFeature.PAST,
      LexicalFeature.PAST_PARTICIPLE,
      LexicalFeature.PRESENT_PARTICIPLE,
      LexicalFeature.PRESENT3S,
    ];
  else if (
    PhraseCategory.ADJECTIVE_PHRASE === cat ||
    LexicalCategory.ADJECTIVE === cat
  )
    return [LexicalFeature.COMPARATIVE, LexicalFeature.SUPERLATIVE];
  else return undefined;
};

export type LexicalFeatureSet = {
  [LexicalFeature.ACRONYM_OF]: string;
  [LexicalFeature.ACRONYMS]: string[];
  [LexicalFeature.DEFAULT_INFL]: Inflection;
  [LexicalFeature.SPELL_VARS]: string[];
  [LexicalFeature.DEFAULT_SPELL]: string;
  [LexicalFeature.BASE_FORM]: string;
  [LexicalFeature.CLASSIFYING]: boolean;
  [LexicalFeature.COLOUR]: boolean;
  [LexicalFeature.COMPARATIVE]: string;
  [LexicalFeature.DITRANSITIVE]: boolean;
  [LexicalFeature.GENDER]: Gender;
  [LexicalFeature.INTENSIFIER]: boolean;
  [LexicalFeature.INTRANSITIVE]: boolean;
  [LexicalFeature.PAST]: string;
  [LexicalFeature.PAST_PARTICIPLE]: string;
  [LexicalFeature.PLURAL]: string;
  [LexicalFeature.PREDICATIVE]: boolean;
  [LexicalFeature.PRESENT_PARTICIPLE]: string;
  [LexicalFeature.PRESENT3S]: string;
  [LexicalFeature.PROPER]: boolean;
  [LexicalFeature.QUALITATIVE]: boolean;
  [LexicalFeature.REFLEXIVE]: boolean;
  [LexicalFeature.SENTENCE_MODIFIER]: boolean;
  [LexicalFeature.SUPERLATIVE]: string;
  [LexicalFeature.TRANSITIVE]: boolean;
  [LexicalFeature.VERB_MODIFIER]: boolean;
  [LexicalFeature.EXPLETIVE_SUBJECT]: boolean;
};
