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
import { Form } from "../features/Form.js";
import { InternalFeature } from "../features/InternalFeature.js";
import { Person } from "../features/Person.js";
import { Tense } from "../features/Tense.js";
import { CoordinatedPhraseElement } from "../framework/CoordinatedPhraseElement.js";
import { NLGElement, BaseFeatureSet } from "../framework/NLGElement.js";
import { InflectedWordElement } from "../framework/InflectedWordElement.js";
import { LexicalCategory } from "../framework/LexicalCategory.js";
import { PhraseCategory } from "../framework/PhraseCategory.js";
import { PhraseElement } from "../framework/PhraseElement.js";
import { WordElement } from "../framework/WordElement.js";

export class VPPhraseSpec extends PhraseElement {
  override defaultValues: {
    [Feature.PERFECT]: boolean;
    [Feature.PROGRESSIVE]: boolean;
    [Feature.PASSIVE]: boolean;
    [Feature.NEGATED]: boolean;
    [Feature.TENSE]: Tense;
    [Feature.PERSON]: Person;
    [Feature.FORM]: Form;
    [InternalFeature.REALISE_AUXILIARY]: boolean;
    // [InternalFeature.HEAD]: NLGElement;
    [Feature.ELIDED]: boolean;
  };

  readonly features: typeof this.defaultValues & Partial<BaseFeatureSet>;

  public static withVerb(
    verb: NLGElement | string,
    context: NLGContext,
  ): VPPhraseSpec {
    const phrase = new VPPhraseSpec(context, verb);
    return phrase;
  }

  public static create(context: NLGContext): VPPhraseSpec {
    const phrase = new VPPhraseSpec(context);
    return phrase;
  }

  private constructor(context: NLGContext, verb?: NLGElement | string) {
    super(PhraseCategory.VERB_PHRASE, context);

    this.defaultValues = {
      [Feature.PERFECT]: false,
      [Feature.PROGRESSIVE]: false,
      [Feature.PASSIVE]: false,
      [Feature.NEGATED]: false,
      [Feature.TENSE]: Tense.PRESENT,
      [Feature.PERSON]: Person.THIRD,
      [Feature.FORM]: Form.NORMAL,
      [InternalFeature.REALISE_AUXILIARY]: true,
      // [InternalFeature.HEAD]: context.getEmpty("Temporary Head"), // set a temporary empty value
      [Feature.ELIDED]: false,
    };
    this.features = { ...this.defaultValues };
    this.verb = verb;
    this.plural = false;
  }

  /**
   * sets the verb (head) of a verb phrase.
   * Extract particle from verb if necessary
   *
   * @param verb - The head verb to use for this VPPhraseSpec
   */
  public set verb(verb: NLGElement | string | undefined) {
    if (verb === undefined) {
      this.head = undefined;
    } else {
      this.head = this.createVerbElement(verb);
    }
  }

  private createVerbElement(verb: string | NLGElement): NLGElement {
    if (typeof verb === "string") {
      const space = verb.indexOf(" ");
      let verbElement: NLGElement;
      if (space === -1) {
        verbElement = this.context.factory.createWord(
          verb,
          LexicalCategory.VERB,
        );
      } else {
        verbElement = this.context.factory.createWord(
          verb.substring(0, space),
          LexicalCategory.VERB,
        );
        this.features[Feature.PARTICLE] = verb.substring(space + 1);
      }
      return verbElement;
    } else {
      return this.context.factory.createWord(verb, LexicalCategory.VERB);
    }
  }

  /**
   * Returns the head verb of this VPPhraseSpec.
   *
   * @returns verb (head) of verb phrase
   */
  public get verb(): NLGElement | undefined {
    return this.head;
  }

  /**
   * Sets the direct object of a clause (assumes this is the only direct object)
   *
   * @param object - The object to use in this VPPhraseSpec
   */
  public setObject(object: NLGElement | string): void {
    let objectPhrase: NLGElement;
    if (
      object instanceof PhraseElement ||
      object instanceof CoordinatedPhraseElement
    ) {
      objectPhrase = object;
    } else {
      objectPhrase = this.context.factory.createNounPhrase(object);
    }

    objectPhrase.features[InternalFeature.DISCOURSE_FUNCTION] =
      DiscourseFunction.OBJECT;
    this.setComplement(objectPhrase);
  }

  /**
   * Returns the direct object of a clause (assumes there is only one)
   *
   * @returns subject of clause (assume only one)
   */
  public getObject(): NLGElement | undefined {
    const complements = this.features[InternalFeature.COMPLEMENTS] ?? [];
    for (const complement of complements) {
      if (
        complement.features[InternalFeature.DISCOURSE_FUNCTION] ===
        DiscourseFunction.OBJECT
      ) {
        return complement;
      }
    }
    return undefined;
  }

  /**
   * Set the indirect object of a clause (assumes this is the only direct indirect object)
   *
   * @param indirectObject - The indirect object to use in this VPPhraseSpec
   */
  public setIndirectObject(indirectObject: NLGElement | string): void {
    let indirectObjectPhrase: NLGElement;
    if (
      indirectObject instanceof PhraseElement ||
      indirectObject instanceof CoordinatedPhraseElement
    ) {
      indirectObjectPhrase = indirectObject;
    } else {
      indirectObjectPhrase =
        this.context.factory.createNounPhrase(indirectObject);
    }

    indirectObjectPhrase.features[InternalFeature.DISCOURSE_FUNCTION] =
      DiscourseFunction.INDIRECT_OBJECT;
    this.setComplement(indirectObjectPhrase);
  }

  /**
   * Returns the indirect object of a clause (assumes there is only one)
   *
   * @returns subject of clause (assume only one)
   */
  public getIndirectObject(): NLGElement | undefined {
    const complements = this.features[InternalFeature.COMPLEMENTS] ?? [];
    for (const complement of complements) {
      if (
        complement.features[InternalFeature.DISCOURSE_FUNCTION] ===
        DiscourseFunction.INDIRECT_OBJECT
      ) {
        return complement;
      }
    }
    return undefined;
  }

  /**
   * Add a modifier to a verb phrase
   * Use heuristics to decide where it goes
   */
  public override addModifier(modifier: NLGElement | string): void {
    if (!modifier) return;

    let modifierElement: NLGElement | undefined;
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

    let modifierWord: WordElement | undefined = undefined;
    if (modifierElement instanceof WordElement) {
      modifierWord = modifierElement;
    } else if (modifierElement instanceof InflectedWordElement) {
      modifierWord = modifierElement.baseWord;
    }

    if (modifierWord && modifierWord.category === LexicalCategory.ADVERB) {
      this.addPreModifier(modifierWord);
      return;
    }

    this.addPostModifier(modifierElement);
  }
}
