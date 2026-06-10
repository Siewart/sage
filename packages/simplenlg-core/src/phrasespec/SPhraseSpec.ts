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
import { ClauseStatus } from "../features/ClauseStatus.js";
import { Feature } from "../features/Feature.js";
import { InternalFeature } from "../features/InternalFeature.js";
import { LexicalFeature } from "../features/LexicalFeature.js";
import { CoordinatedPhraseElement } from "../framework/CoordinatedPhraseElement.js";
import { NLGElement, BaseFeatureSet } from "../framework/NLGElement.js";
import { InflectedWordElement } from "../framework/InflectedWordElement.js";
import { LexicalCategory } from "../framework/LexicalCategory.js";
import { PhraseCategory } from "../framework/PhraseCategory.js";
import { PhraseElement } from "../framework/PhraseElement.js";
import { WordElement } from "../framework/WordElement.js";
import { cloneInto } from "../utils.js";
import { AdvPhraseSpec } from "./AdvPhraseSpec.js";
import { VPPhraseSpec } from "./VPPhraseSpec.js";

export class SPhraseSpec extends PhraseElement {
  override defaultValues: {
    [Feature.ELIDED]: boolean;
    [InternalFeature.CLAUSE_STATUS]: ClauseStatus;
    [Feature.SUPRESSED_COMPLEMENTISER]: boolean;
    [LexicalFeature.EXPLETIVE_SUBJECT]: boolean;
    [Feature.COMPLEMENTISER]: NLGElement;
    [InternalFeature.VERB_PHRASE]: NLGElement;
    [InternalFeature.HEAD]: NLGElement;
  };

  readonly features: typeof this.defaultValues & Partial<BaseFeatureSet>;

  private static readonly vpFeatures = [
    // TODO (later): This should be linked to the actual VP implemenation
    Feature.MODAL,
    Feature.TENSE,
    Feature.NEGATED,
    Feature.NUMBER,
    Feature.PASSIVE,
    Feature.PERFECT,
    Feature.PARTICLE,
    Feature.PERSON,
    Feature.PROGRESSIVE,
    InternalFeature.REALISE_AUXILIARY,
    Feature.FORM,
    Feature.INTERROGATIVE_TYPE,
  ];

  public static create(context: NLGContext): SPhraseSpec {
    return new SPhraseSpec(context);
  }

  public static withVerbPhrase(
    verbPhrase: NLGElement,
    context: NLGContext,
  ): SPhraseSpec {
    const phrase = new SPhraseSpec(context, verbPhrase);
    return phrase;
  }

  public static withVerb(
    verb: NLGElement | string,
    context: NLGContext,
  ): SPhraseSpec {
    const verbPhrase = context.factory.createVerbPhrase(verb);
    const phrase = new SPhraseSpec(context, verbPhrase);
    return phrase;
  }

  private constructor(context: NLGContext, verbPhrase?: NLGElement) {
    super(PhraseCategory.CLAUSE, context);

    // create VP
    const vp = verbPhrase ?? context.factory.createVerbPhrase();

    // set default values
    this.defaultValues = {
      // TODO (later): Is this not always the same as the VP? This would make the type dependent on the VP's type.
      [Feature.ELIDED]: false,
      [InternalFeature.CLAUSE_STATUS]: ClauseStatus.MATRIX,
      [Feature.SUPRESSED_COMPLEMENTISER]: false,
      [LexicalFeature.EXPLETIVE_SUBJECT]: false,
      [Feature.COMPLEMENTISER]: context.factory.createWord(
        "that",
        LexicalCategory.COMPLEMENTISER,
      ),
      [InternalFeature.VERB_PHRASE]: vp,
      [InternalFeature.HEAD]: vp,
    };

    this.features = new Proxy({} as typeof this.features, {
      set: (
        target,
        prop: keyof typeof this.features,
        value: (typeof this.features)[keyof typeof this.features],
      ) => {
        if (
          SPhraseSpec.vpFeatures.includes(
            prop
              .toString()
              .toLowerCase() as (typeof SPhraseSpec.vpFeatures)[number],
          )
        ) {
          const verbPhrase = this.features[InternalFeature.VERB_PHRASE];
          if (verbPhrase !== null) {
            verbPhrase.features[prop] = value;
          }
        }
        return Reflect.set(target, prop, value);
      },
      get: (target, prop: keyof typeof this.features) => {
        if (
          SPhraseSpec.vpFeatures.includes(
            prop
              .toString()
              .toLowerCase() as (typeof SPhraseSpec.vpFeatures)[number],
          )
        ) {
          const verbPhrase = this.features[InternalFeature.VERB_PHRASE];
          if (verbPhrase !== null) {
            // Conversion note: The Java code also did an || instanceof VPPhraseSpec check here, but that is redundant (also in java this is a short circuit check)
            return verbPhrase.features[prop];
          }
        }
        return Reflect.get(target, prop);
      },
    });

    cloneInto(this.defaultValues, this.features, true);
    this.verbPhrase = vp;
    this.head = vp;
  }

  public override addPreModifier(newPreModifier: NLGElement): void {
    const verbPhrase = this.features[InternalFeature.VERB_PHRASE];

    if (
      verbPhrase instanceof PhraseElement ||
      verbPhrase instanceof CoordinatedPhraseElement
    ) {
      verbPhrase.addPreModifier(newPreModifier);
    } else {
      super.addPreModifier(newPreModifier);
    }
  }

  public override addComplement(complement: NLGElement): void {
    const verbPhrase = this.features[InternalFeature.VERB_PHRASE];
    if (verbPhrase instanceof VPPhraseSpec) {
      verbPhrase.addComplement(complement);
    } else {
      super.addComplement(complement);
    }
  }

  public override addComplementString(complement: string): void {
    const verbPhrase = this.features[InternalFeature.VERB_PHRASE];
    if (verbPhrase instanceof VPPhraseSpec) {
      verbPhrase.addComplementString(complement);
    } else {
      super.addComplementString(complement);
    }
  }

  public get verbPhrase(): NLGElement | undefined {
    return this.features[InternalFeature.VERB_PHRASE];
  }

  public set verbPhrase(vp: NLGElement) {
    // if(vp === undefined) {
    //   const oldVP = this.features[InternalFeature.VERB_PHRASE];
    //   if(oldVP && oldVP.parent) {
    //     oldVP.parent = undefined;
    //   }
    //   delete this.features[InternalFeature.VERB_PHRASE];
    // } else {
    this.features[InternalFeature.VERB_PHRASE] = vp; // TODO (later): Doesn't this set the VP to have a VP that is itself as well? Is that desriable, is it returned in getChildren?
    vp.parent = this; // needed for syntactic processing
    // }
  }

  public set verb(verb: NLGElement | string) {
    const verbPhraseElement = this.verbPhrase;
    if (verbPhraseElement instanceof VPPhraseSpec) {
      verbPhraseElement.verb = verb;
    }
  }

  public get verb(): NLGElement | undefined {
    const verbPhrase = this.features[InternalFeature.VERB_PHRASE];
    if (verbPhrase instanceof VPPhraseSpec) {
      return verbPhrase.head;
    }
    return undefined;
  }

  // Conversion note: it is possible to have multiple subjects but we only allow setting one like this
  public setSubject(subject: NLGElement | string): void {
    let subjectPhrase: NLGElement;
    if (
      subject instanceof PhraseElement ||
      subject instanceof CoordinatedPhraseElement
    ) {
      subjectPhrase = subject;
    } else {
      subjectPhrase = this.context.factory.createNounPhrase(subject);
    }
    this.features[InternalFeature.SUBJECTS] = [subjectPhrase];
  }

  public getSubject(): NLGElement | undefined {
    const subjects = this.features[InternalFeature.SUBJECTS];
    if (subjects?.length === 0 || subjects?.[0] === undefined) {
      return undefined;
    }
    return subjects[0];
  }

  public setObject(object: NLGElement | string): void {
    const verbPhraseElement = this.verbPhrase;
    if (verbPhraseElement instanceof VPPhraseSpec) {
      verbPhraseElement.setObject(object);
    }
  }

  public getObject(): NLGElement | undefined {
    const verbPhrase = this.features[InternalFeature.VERB_PHRASE];
    if (verbPhrase instanceof VPPhraseSpec) {
      return verbPhrase.getObject();
    }
    return undefined;
  }

  public setIndirectObject(indirectObject: NLGElement | string): void {
    if (this.verbPhrase instanceof VPPhraseSpec) {
      this.verbPhrase.setIndirectObject(indirectObject);
    }
  }

  public getIndirectObject(): NLGElement | undefined {
    if (this.verbPhrase instanceof VPPhraseSpec) {
      return this.verbPhrase.getIndirectObject();
    }
    return undefined;
  }

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

    if (modifierElement instanceof AdvPhraseSpec) {
      this.addPreModifier(modifierElement);
      return;
    }

    let modifierWord: WordElement | undefined = undefined;
    if (modifierElement instanceof WordElement) {
      modifierWord = modifierElement;
    } else if (modifierElement instanceof InflectedWordElement) {
      modifierWord = modifierElement.baseWord;
    }

    if (modifierWord && modifierWord.category === LexicalCategory.ADVERB) {
      if (modifierWord.features[LexicalFeature.SENTENCE_MODIFIER]) {
        this.addFrontModifier(modifierWord);
      } else {
        this.addPreModifier(modifierWord);
      }
      return;
    }

    this.addPostModifier(modifierElement);
  }
}
