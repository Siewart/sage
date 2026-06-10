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

import { NLGContext } from "../factory/NLGContext.js";
import { DiscourseFunction } from "../features/DiscourseFunction.js";
import { Feature } from "../features/Feature.js";
import { Gender } from "../features/Gender.js";
import { InternalFeature } from "../features/InternalFeature.js";
import { LexicalFeature } from "../features/LexicalFeature.js";
import { Person } from "../features/Person.js";
import { NLGElement, BaseFeatureSet } from "../framework/NLGElement.js";
import { InflectedWordElement } from "../framework/InflectedWordElement.js";
import { LexicalCategory } from "../framework/LexicalCategory.js";
import { PhraseCategory } from "../framework/PhraseCategory.js";
import { PhraseElement } from "../framework/PhraseElement.js";
import { WordElement } from "../framework/WordElement.js";
import { AdjPhraseSpec } from "./AdjPhraseSpec.js";

export class NPPhraseSpec extends PhraseElement {
  override defaultValues: {
    [Feature.ELIDED]: boolean;
    [InternalFeature.HEAD]: NLGElement;
  };

  override readonly features: typeof this.defaultValues &
    Partial<BaseFeatureSet>;

  public static create(noun: NLGElement, context: NLGContext): NPPhraseSpec {
    const phrase = new NPPhraseSpec(noun, context);
    return phrase;
  }

  private constructor(noun: NLGElement, context: NLGContext) {
    super(PhraseCategory.NOUN_PHRASE, context);

    // set default values
    this.defaultValues = {
      [Feature.ELIDED]: false,
      [InternalFeature.HEAD]: context.getEmpty("Temporary Head"),
    };

    this.features = { ...this.defaultValues };
    this.noun = noun; // this sets the head
  }

  /**
   * Sets the noun (head) of a noun phrase
   *
   * @param noun - Sets the head noun for this NPPhraseSpec
   */
  public set noun(noun: NLGElement | string) {
    const nounElement =
      typeof noun === "string"
        ? this.context.factory.createWord(noun, LexicalCategory.NOUN)
        : noun;
    this.head = nounElement;
  }

  /**
   * @returns noun (head) of noun phrase
   */
  public get noun(): NLGElement | undefined {
    return this.head;
  }

  /**
   * setDeterminer - Convenience method for when a person tries to set
   * a determiner (e.g. "the") to a NPPhraseSpec.
   */
  public set determiner(determiner: NLGElement | string | null) {
    this.specifier = determiner;
  }

  /**
   * getDeterminer - Convenience method for when a person tries to get a
   * determiner (e.g. "the") from a NPPhraseSpec.
   *
   * @returns the determiner NLGElement for this NPPhraseSpec
   */
  public get determiner(): NLGElement | null {
    return this.specifier;
  }

  /**
   * sets the specifier of a noun phrase. Can be determiner (eg "the"),
   * possessive (eg, "John's")
   *
   * @param specifier - Sets a specifier for this NPPhraseSpec
   */
  public set specifier(specifier: NLGElement | string | null) {
    if (specifier === null) {
      delete this.features[InternalFeature.SPECIFIER];
      return;
    }
    if (specifier instanceof NLGElement) {
      this.features[InternalFeature.SPECIFIER] = specifier;
      specifier.features[InternalFeature.DISCOURSE_FUNCTION] =
        DiscourseFunction.SPECIFIER;
    } else {
      // create specifier as word (assume determiner)
      const specifierElement = this.context.factory.createWord(
        specifier,
        LexicalCategory.DETERMINER,
      );

      // set specifier feature
      if (specifierElement) {
        this.features[InternalFeature.SPECIFIER] = specifierElement;
        specifierElement.features[InternalFeature.DISCOURSE_FUNCTION] =
          DiscourseFunction.SPECIFIER;
      }
    }
  }

  /**
   * @returns specifier (eg, determiner) of noun phrase
   */
  public get specifier(): NLGElement | null {
    return this.features[InternalFeature.SPECIFIER] ?? null;
  }

  /**
   * Add a modifier to an NP Use heuristics to decide where it goes
   */
  public override addModifier(modifier: NLGElement | string): void {
    let modifierElement: NLGElement | undefined = undefined;
    if (modifier instanceof NLGElement) {
      modifierElement = modifier;
    } else if (typeof modifier === "string") {
      if (modifier.length > 0 && !modifier.includes(" ")) {
        modifierElement = this.context.factory.createWord(
          modifier,
          LexicalCategory.ANY,
        );
      }
    }

    if (!modifierElement) {
      this.addPostModifier(modifier);
      return;
    }

    if (modifierElement instanceof AdjPhraseSpec) {
      this.addPreModifier(modifierElement);
      return;
    }

    let modifierWord: WordElement | undefined = undefined;
    if (modifierElement instanceof WordElement) {
      modifierWord = modifierElement;
    } else if (modifierElement instanceof InflectedWordElement) {
      modifierWord = modifierElement.baseWord;
    }

    if (modifierWord && modifierWord.category === LexicalCategory.ADJECTIVE) {
      this.addPreModifier(modifierWord);
      return;
    }

    this.addPostModifier(modifierElement);
  }

  private setNounPhraseFeatures(nounElement: NLGElement): void {
    this.features[Feature.POSSESSIVE] =
      nounElement.features[Feature.POSSESSIVE] ?? false;
    this.features[InternalFeature.RAISED] = false;
    this.features[InternalFeature.ACRONYM] = false;

    const number = nounElement.features[Feature.NUMBER];
    const person = nounElement.features[Feature.PERSON];
    const gender = nounElement.features[LexicalFeature.GENDER];
    const expletiveSubject =
      nounElement.features[LexicalFeature.EXPLETIVE_SUBJECT];

    if (number !== undefined) {
      this.features[Feature.NUMBER] = number;
    } else {
      this.plural = false;
    }

    if (person !== undefined) {
      this.features[Feature.PERSON] = person;
    } else {
      this.features[Feature.PERSON] = Person.THIRD;
    }

    if (gender !== undefined) {
      this.features[LexicalFeature.GENDER] = gender;
    } else {
      this.features[LexicalFeature.GENDER] = Gender.NEUTER;
    }

    if (expletiveSubject !== undefined) {
      this.features[LexicalFeature.EXPLETIVE_SUBJECT] = expletiveSubject;
    }

    this.features[Feature.ADJECTIVE_ORDERING] = true;
  }

  public override set head(newHead: NLGElement) {
    super.head = newHead;
    this.setNounPhraseFeatures(super.head);
  }

  public override get head(): NLGElement | undefined {
    return super.head;
  }
}
