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

import { NLGElement } from "../../framework/NLGElement.js";
import { Feature } from "../../features/Feature.js";
import { LexicalFeature } from "../../features/LexicalFeature.js";
import { InternalFeature } from "../../features/InternalFeature.js";
import { DiscourseFunction } from "../../features/DiscourseFunction.js";
import { NumberAgreement } from "../../features/NumberAgreement.js";
import { Person } from "../../features/Person.js";
import { Tense } from "../../features/Tense.js";
import { Form } from "../../features/Form.js";
import { Inflection } from "../../features/Inflection.js";
import { Gender } from "../../features/Gender.js";
import { DeterminerAgrHelper } from "./DeterminerAgrHelper.js";
import { copyField } from "../../utils.js";
import { InflectedWordElement } from "../../framework/InflectedWordElement.js";
import { LexicalCategory } from "../../framework/LexicalCategory.js";
import { NLGModule } from "../../framework/NLGModule.js";
import { StringElement } from "../../framework/StringElement.js";
import { WordElement } from "../../framework/WordElement.js";

export abstract class MorphologyRules extends NLGModule {
  public static readonly PRONOUNS = [
    [
      ["I", "you", "he", "she", "it"],
      ["me", "you", "him", "her", "it"],
      ["myself", "yourself", "himself", "herself", "itself"],
      ["mine", "yours", "his", "hers", "its"],
      ["my", "your", "his", "her", "its"],
    ],
    [
      ["we", "you", "they", "they", "they"],
      ["us", "you", "them", "them", "them"],
      ["ourselves", "yourselves", "themselves", "themselves", "themselves"],
      ["ours", "yours", "theirs", "theirs", "theirs"],
      ["our", "your", "their", "their", "their"],
    ],
  ] as const;

  private static readonly WH_PRONOUNS = [
    "who",
    "what",
    "which",
    "where",
    "why",
    "how",
    "how many",
  ] as const;

  static doNounMorphology(
    element: InflectedWordElement,
    baseWord: WordElement,
  ): StringElement {
    let realised = "";

    const baseForm = this.getBaseForm(element, baseWord);

    if (element.plural && !element.features[LexicalFeature.PROPER]) {
      let pluralForm = element.features[LexicalFeature.PLURAL];

      const elementDefaultInfl = element.features[LexicalFeature.DEFAULT_INFL];

      if (
        elementDefaultInfl != null &&
        elementDefaultInfl === Inflection.UNCOUNT
      ) {
        pluralForm = baseForm;
      }

      if (!pluralForm && baseWord) {
        const baseDefaultInfelection =
          baseWord.features[LexicalFeature.DEFAULT_INFL];
        if (baseDefaultInfelection === Inflection.UNCOUNT) {
          pluralForm = baseForm;
        }
      }

      if (!pluralForm) {
        const pattern = element.features[LexicalFeature.DEFAULT_INFL];
        if (Inflection.GRECO_LATIN_REGULAR === pattern) {
          pluralForm = this.buildGrecoLatinPluralNoun(baseForm);
        } else {
          pluralForm = this.buildRegularPluralNoun(baseForm);
        }
      }
      realised = pluralForm;
    } else {
      realised = baseForm;
    }

    realised = this.checkPossessive(element, realised);
    const realisedElement = StringElement.fromString(realised, element.context);

    copyField(
      element.features,
      realisedElement.features,
      InternalFeature.DISCOURSE_FUNCTION,
    );

    return realisedElement;
  }

  private static buildRegularPluralNoun(baseForm: string): string {
    let plural = "";
    if (baseForm) {
      if (baseForm.match(/.*[b-df-hj-np-tv-z]y\b/)) {
        plural = baseForm.replace(/y\b/, "ies");
      } else if (baseForm.match(/.*([szx]|[cs]h)\b/)) {
        plural = baseForm + "es";
      } else {
        plural = baseForm + "s";
      }
    }
    return plural;
  }

  private static buildGrecoLatinPluralNoun(baseForm: string): string {
    let plural = "";
    if (baseForm) {
      if (baseForm.endsWith("us")) {
        plural = baseForm.replace(/us\b/, "i");
      } else if (baseForm.endsWith("ma")) {
        plural = baseForm + "ta";
      } else if (baseForm.endsWith("a")) {
        plural = baseForm + "e";
      } else if (baseForm.match(/.*((um|on))\b/)) {
        // Conversion note: in Java this regex was likely incorrect. Now it matches words ending with um or on, and replaces it with an a, as is in line with grecolatin plural nouns
        plural = baseForm.replace(/(um|on)\b/, "a");
      } else if (baseForm.endsWith("sis")) {
        plural = baseForm.replace(/sis\b/, "ses");
      } else if (baseForm.endsWith("is")) {
        plural = baseForm.replace(/is\b/, "ides");
      } else if (baseForm.endsWith("men")) {
        plural = baseForm.replace(/men\b/, "mina");
      } else if (baseForm.endsWith("ex")) {
        plural = baseForm.replace(/ex\b/, "ices");
      } else if (baseForm.endsWith("x")) {
        plural = baseForm.replace(/x\b/, "ces");
      } else {
        plural = baseForm;
      }
    }
    return plural;
  }

  static doVerbMorphology(
    element: InflectedWordElement,
    baseWord: WordElement,
  ): NLGElement {
    let realised = "";
    const numberValue = element.features[Feature.NUMBER];
    const personValue = element.features[Feature.PERSON];
    const tense = element.features[Feature.TENSE];
    const tenseValue = tense instanceof Tense ? tense : Tense.PRESENT;
    const formValue = element.features[Feature.FORM];
    const patternValue = element.features[LexicalFeature.DEFAULT_INFL];
    const baseForm = this.getBaseForm(element, baseWord);

    if (
      element.features[Feature.NEGATED] ||
      Form.BARE_INFINITIVE === formValue
    ) {
      realised = baseForm;
    } else if (Form.PRESENT_PARTICIPLE === formValue) {
      realised =
        element.features[LexicalFeature.PRESENT_PARTICIPLE] ||
        baseWord?.features[LexicalFeature.PRESENT_PARTICIPLE] ||
        (Inflection.REGULAR_DOUBLE === patternValue
          ? this.buildDoublePresPartVerb(baseForm)
          : this.buildRegularPresPartVerb(baseForm));
    } else if (
      Tense.PAST === tenseValue ||
      Form.PAST_PARTICIPLE === formValue
    ) {
      if (Form.PAST_PARTICIPLE === formValue) {
        realised =
          element.features[LexicalFeature.PAST_PARTICIPLE] ||
          baseWord?.features[LexicalFeature.PAST_PARTICIPLE] ||
          (baseForm.toLowerCase() === "be"
            ? "been"
            : Inflection.REGULAR_DOUBLE === patternValue
              ? this.buildDoublePastVerb(baseForm)
              : this.buildRegularPastVerb(baseForm, numberValue, personValue));
      } else {
        realised =
          element.features[LexicalFeature.PAST] ||
          baseWord?.features[LexicalFeature.PAST] ||
          (Inflection.REGULAR_DOUBLE === patternValue
            ? this.buildDoublePastVerb(baseForm)
            : this.buildRegularPastVerb(baseForm, numberValue, personValue));
      }
    } else if (
      (numberValue === undefined || NumberAgreement.SINGULAR === numberValue) &&
      (personValue === undefined || Person.THIRD === personValue) &&
      (tenseValue === undefined || Tense.PRESENT === tenseValue)
    ) {
      realised =
        element.features[LexicalFeature.PRESENT3S] ??
        (baseWord && baseForm.toLowerCase() !== "be"
          ? baseWord.features[LexicalFeature.PRESENT3S]
          : this.buildPresent3SVerb(baseForm)) ??
        this.buildPresent3SVerb(baseForm);
    } else {
      realised =
        baseForm.toLowerCase() === "be"
          ? Person.FIRST === personValue &&
            (NumberAgreement.SINGULAR === numberValue || numberValue === null)
            ? "am"
            : "are"
          : baseForm;
    }

    const realisedElement = StringElement.fromString(realised, element.context);
    copyField(
      element.features,
      realisedElement.features,
      InternalFeature.DISCOURSE_FUNCTION,
    );
    return realisedElement;
  }

  private static getBaseForm(
    element: InflectedWordElement,
    baseWord: WordElement,
  ): string {
    if (element.category === LexicalCategory.VERB) {
      return baseWord?.defaultSpellingVariant || element.baseForm;
    } else {
      return element.baseForm || baseWord?.defaultSpellingVariant || "";
    }
  }

  private static checkPossessive(
    element: InflectedWordElement,
    realised: string,
  ): string {
    if (element.features[Feature.POSSESSIVE]) {
      realised += realised.endsWith("s") ? "'" : "'s";
    }
    return realised;
  }

  private static buildPresent3SVerb(baseForm: string): string {
    if (baseForm.toLowerCase() === "be") {
      return "is";
    } else if (baseForm.match(/.*([szx]|ch|sh)\b/)) {
      return baseForm + "es";
    } else if (baseForm.match(/.*[b-df-hj-np-tv-z]y\b/)) {
      return baseForm.replace(/y\b/, "ies");
    } else {
      return baseForm + "s";
    }
  }

  private static buildRegularPastVerb(
    baseForm: string,
    number: NumberAgreement,
    person: Person,
  ): string {
    if (baseForm.toLowerCase() === "be") {
      if (NumberAgreement.PLURAL === number || Person.SECOND === person) {
        return "were";
      } else {
        return "was";
      }
    } else if (baseForm.endsWith("e")) {
      return baseForm + "d";
    } else if (baseForm.match(/.*[b-df-hj-np-tv-z]y\b/)) {
      return baseForm.replace(/y\b/, "ied");
    } else {
      return baseForm + "ed";
    }
  }

  private static buildDoublePastVerb(baseForm: string): string {
    return baseForm + baseForm.charAt(baseForm.length - 1) + "ed";
  }

  private static buildRegularPresPartVerb(baseForm: string): string {
    if (baseForm.toLowerCase() === "be") {
      return "being";
    } else if (baseForm.endsWith("ie")) {
      return baseForm.replace(/ie\b/, "ying");
    } else if (baseForm.match(/.*[^iyeo]e\b/)) {
      return baseForm.replace(/e\b/, "ing");
    } else {
      return baseForm + "ing";
    }
  }

  private static buildDoublePresPartVerb(baseForm: string): string {
    return baseForm + baseForm.charAt(baseForm.length - 1) + "ing";
  }

  public static doAdjectiveMorphology(
    element: InflectedWordElement,
    baseWord: WordElement,
  ): NLGElement {
    let realised = "";
    const patternValue = element.features[LexicalFeature.DEFAULT_INFL];
    const baseForm = this.getBaseForm(element, baseWord);

    if (element.features[Feature.IS_COMPARATIVE]) {
      realised =
        element.features[LexicalFeature.COMPARATIVE] ||
        baseWord?.features[LexicalFeature.COMPARATIVE] ||
        Inflection.REGULAR_DOUBLE === patternValue
          ? this.buildDoubleCompAdjective(baseForm)
          : this.buildRegularComparative(baseForm);
    } else if (element.features[Feature.IS_SUPERLATIVE]) {
      realised =
        element.features[LexicalFeature.SUPERLATIVE] ||
        baseWord?.features[LexicalFeature.SUPERLATIVE] ||
        Inflection.REGULAR_DOUBLE === patternValue
          ? this.buildDoubleSuperAdjective(baseForm)
          : this.buildRegularSuperlative(baseForm);
    } else {
      realised = baseForm;
    }

    const realisedElement = StringElement.fromString(realised, element.context);
    copyField(
      element.features,
      realisedElement.features,
      InternalFeature.DISCOURSE_FUNCTION,
    );
    return realisedElement;
  }

  private static buildDoubleCompAdjective(baseForm: string): string {
    return baseForm + baseForm.charAt(baseForm.length - 1) + "er";
  }

  private static buildRegularComparative(baseForm: string): string {
    if (baseForm.match(/.*[b-df-hj-np-tv-z]y\b/)) {
      return baseForm.replace(/y\b/, "ier");
    } else if (baseForm.endsWith("e")) {
      return baseForm + "r";
    } else {
      return baseForm + "er";
    }
  }

  private static buildDoubleSuperAdjective(baseForm: string): string {
    return baseForm + baseForm.charAt(baseForm.length - 1) + "est";
  }

  private static buildRegularSuperlative(baseForm: string): string {
    if (baseForm.match(/.*[b-df-hj-np-tv-z]y\b/)) {
      return baseForm.replace(/y\b/, "iest");
    } else if (baseForm.endsWith("e")) {
      return baseForm + "st";
    } else {
      return baseForm + "est";
    }
  }

  public static doAdverbMorphology(
    element: InflectedWordElement,
    baseWord: WordElement,
  ): NLGElement {
    let realised = "";
    const baseForm = this.getBaseForm(element, baseWord);

    if (element.features[Feature.IS_COMPARATIVE]) {
      realised =
        element.features[LexicalFeature.COMPARATIVE] ||
        baseWord?.features[LexicalFeature.COMPARATIVE] ||
        this.buildRegularComparative(baseForm);
    } else if (element.features[Feature.IS_SUPERLATIVE]) {
      realised =
        element.features[LexicalFeature.SUPERLATIVE] ||
        baseWord?.features[LexicalFeature.SUPERLATIVE] ||
        this.buildRegularSuperlative(baseForm);
    } else {
      realised = baseForm;
    }

    const realisedElement = StringElement.fromString(realised, element.context);
    copyField(
      element.features,
      realisedElement.features,
      InternalFeature.DISCOURSE_FUNCTION,
    );
    return realisedElement;
  }

  public static doPronounMorphology(element: InflectedWordElement): NLGElement {
    let realised = "";

    if (
      !element.features[InternalFeature.NON_MORPH] &&
      !this.isWHPronoun(element)
    ) {
      const genderValue = element.features[LexicalFeature.GENDER];
      const personValue = element.features[Feature.PERSON];
      const discourseValue =
        element.features[InternalFeature.DISCOURSE_FUNCTION];

      const numberIndex = element.plural ? 1 : 0;
      const genderIndex =
        genderValue instanceof Gender ? genderValue.ordinal : 2;
      let personIndex = personValue instanceof Person ? personValue.ordinal : 2;

      if (personIndex === 2) {
        personIndex += genderIndex;
      }

      let positionIndex = 0;

      if (element.features[LexicalFeature.REFLEXIVE]) {
        positionIndex = 2;
      } else if (element.features[Feature.POSSESSIVE]) {
        positionIndex = 3;
        if (DiscourseFunction.SPECIFIER === discourseValue) {
          positionIndex++;
        }
      } else {
        positionIndex =
          (DiscourseFunction.SUBJECT === discourseValue &&
            !element.features[Feature.PASSIVE]) ||
          (DiscourseFunction.OBJECT === discourseValue &&
            element.features[Feature.PASSIVE]) ||
          DiscourseFunction.SPECIFIER === discourseValue ||
          (DiscourseFunction.COMPLEMENT === discourseValue &&
            element.features[Feature.PASSIVE])
            ? 0
            : 1;
      }
      realised =
        this.PRONOUNS?.[numberIndex]?.[positionIndex]?.[personIndex] ??
        this.PRONOUNS[0][0][2];
    } else {
      realised = element.baseForm;
    }

    const realisedElement = StringElement.fromString(realised, element.context);
    copyField(
      element.features,
      realisedElement.features,
      InternalFeature.DISCOURSE_FUNCTION,
    );
    return realisedElement;
  }

  private static isWHPronoun(word: InflectedWordElement): boolean {
    const base = word.baseForm;
    return this.WH_PRONOUNS.includes(base as (typeof this.WH_PRONOUNS)[number]);
  }

  public static doDeterminerMorphology(
    determiner: NLGElement,
    realisation: string | undefined,
  ): void {
    if (realisation) {
      if (determiner.realisation !== "a") {
        if (determiner.plural) {
          if (determiner.realisation === "that") {
            determiner.realisation = "those";
          } else if (determiner.realisation === "this") {
            determiner.realisation = "these";
          }
        } else if (!determiner.plural) {
          if (determiner.realisation === "those") {
            determiner.realisation = "that";
          } else if (determiner.realisation === "these") {
            determiner.realisation = "this";
          }
        }
      }

      if (determiner.realisation === "a") {
        if (determiner.plural) {
          determiner.realisation = "some";
        } else if (DeterminerAgrHelper.requiresAn(realisation)) {
          determiner.realisation = "an";
        }
      }
    }
  }
}
