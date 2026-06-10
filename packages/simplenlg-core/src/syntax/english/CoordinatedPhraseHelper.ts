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

import { DiscourseFunction } from "../../features/DiscourseFunction.js";
import { Feature } from "../../features/Feature.js";
import { InternalFeature } from "../../features/InternalFeature.js";
import { LexicalFeature } from "../../features/LexicalFeature.js";
import { CoordinatedPhraseElement } from "../../framework/CoordinatedPhraseElement.js";
import { NLGElement } from "../../framework/NLGElement.js";
import { InflectedWordElement } from "../../framework/InflectedWordElement.js";
import { LexicalCategory } from "../../framework/LexicalCategory.js";
import { ListElement } from "../../framework/ListElement.js";
import { PhraseCategory } from "../../framework/PhraseCategory.js";
import { RealisedCategory } from "../../framework/RealisedCategory.js";
import { WordElement } from "../../framework/WordElement.js";
import { copyField, cloneInto } from "../../utils.js";
import { SyntaxProcessor } from "./SyntaxProcessor.js";
import { PhraseHelper } from "./PhraseHelper.js";

export class CoordinatedPhraseHelper {
  public static realise(
    parent: SyntaxProcessor,
    phrase: CoordinatedPhraseElement,
  ): NLGElement | undefined {
    if (!phrase) return undefined;

    const realisedElement = ListElement.create(
      RealisedCategory.REALISED_COORDINATED_PHRASE,
      parent.context,
    );
    PhraseHelper.realiseList(
      parent,
      realisedElement,
      phrase.preModifiers,
      DiscourseFunction.PRE_MODIFIER,
    );

    const coordinated = CoordinatedPhraseElement.create(
      RealisedCategory.REALISED_COORDINATED_PHRASE,
      phrase.context,
    );
    const children = phrase.getChildren();
    const conjunction: string = phrase.features[Feature.CONJUNCTION];

    coordinated.features[Feature.CONJUNCTION] = conjunction;
    copyField(phrase.features, coordinated.features, Feature.CONJUNCTION_TYPE);

    if (children.length > 0 && children[0] !== undefined) {
      if (phrase.features[Feature.RAISE_SPECIFIER]) {
        this.raiseSpecifier(children);
      }

      let child = phrase.lastCoordinate;
      if (child) {
        copyField(phrase.features, child.features, Feature.POSSESSIVE);
      }

      child = children[0];
      this.setChildFeatures(phrase, child);
      const realised = parent.realise(child);
      coordinated.addCoordinate(realised);

      for (let index = 1; index < children.length; index++) {
        child = children[index];
        if (!child) continue;
        this.setChildFeatures(phrase, child);

        if (phrase.features[Feature.AGGREGATE_AUXILIARY]) {
          child.features[InternalFeature.REALISE_AUXILIARY] = false;
        }

        if (child.isA(PhraseCategory.CLAUSE)) {
          copyField(
            phrase.features,
            child.features,
            Feature.SUPRESSED_COMPLEMENTISER,
          );
        }

        if (conjunction) {
          const conjunctionElement = InflectedWordElement.fromString(
            conjunction,
            LexicalCategory.CONJUNCTION,
            parent.context,
          );
          conjunctionElement.features[InternalFeature.DISCOURSE_FUNCTION] =
            DiscourseFunction.CONJUNCTION;
          coordinated.addCoordinate(conjunctionElement);
        }
        const realised = parent.realise(child);
        coordinated.addCoordinate(realised);
      }
      realisedElement.addComponent(coordinated);
    }

    PhraseHelper.realiseList(
      parent,
      realisedElement,
      phrase.postModifiers,
      DiscourseFunction.POST_MODIFIER,
    );

    PhraseHelper.realiseList(
      parent,
      realisedElement,
      phrase.complements,
      DiscourseFunction.COMPLEMENT,
    );

    return realisedElement;
  }

  private static setChildFeatures(
    phrase: CoordinatedPhraseElement,
    child: NLGElement,
  ): void {
    const features = [
      Feature.PROGRESSIVE,
      Feature.PERFECT,
      InternalFeature.SPECIFIER,
      LexicalFeature.GENDER,
      Feature.NUMBER,
      Feature.TENSE,
      Feature.PERSON,
      Feature.NEGATED,
      Feature.MODAL,
      InternalFeature.DISCOURSE_FUNCTION,
      Feature.FORM,
      InternalFeature.CLAUSE_STATUS,
    ];

    cloneInto(phrase.features, child.features, false, features);

    if (phrase.features[Feature.INTERROGATIVE_TYPE]) {
      child.features[InternalFeature.IGNORE_MODAL] = true;
    }
  }

  private static raiseSpecifier(children: NLGElement[]): void {
    if (!children.length) return;

    const firstChild = children[0];
    const specifier = firstChild?.features[InternalFeature.SPECIFIER];

    if (!specifier) return;

    const test =
      specifier instanceof WordElement
        ? specifier.baseForm
        : specifier.features[LexicalFeature.BASE_FORM];

    if (!test) return;

    const allMatch = children.slice(1).every((child) => {
      if (!child) return false;

      const childSpecifier = child.features[InternalFeature.SPECIFIER];
      const childForm =
        childSpecifier instanceof WordElement
          ? childSpecifier.baseForm
          : childSpecifier?.features[LexicalFeature.BASE_FORM];

      return test === childForm;
    });

    if (allMatch) {
      children.slice(1).forEach((child) => {
        if (child) child.features[InternalFeature.RAISED] = true;
      });
    }
  }
}
