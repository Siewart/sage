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

import { NLGContext } from "../../factory/NLGContext.js";
import { DiscourseFunction } from "../../features/DiscourseFunction.js";
import { Feature } from "../../features/Feature.js";
import { InternalFeature } from "../../features/InternalFeature.js";
import { NLGElement } from "../../framework/NLGElement.js";
import { InflectedWordElement } from "../../framework/InflectedWordElement.js";
import { StringElement } from "../../framework/StringElement.js";
import { WordElement } from "../../framework/WordElement.js";
import { DocumentElement } from "../../framework/DocumentElement.js";
import { ListElement } from "../../framework/ListElement.js";
import { CoordinatedPhraseElement } from "../../framework/CoordinatedPhraseElement.js";
import { NLGModule } from "../../framework/NLGModule.js";
import { LexicalCategory } from "../../framework/LexicalCategory.js";
import { RealisedCategory } from "../../framework/RealisedCategory.js";
import { copyField } from "../../utils.js";
import { DeterminerAgrHelper } from "./DeterminerAgrHelper.js";
import { MorphologyRules } from "./MorphologyRules.js";

export class MorphologyProcessor extends NLGModule {
  public static create(context: NLGContext): MorphologyProcessor {
    return new MorphologyProcessor(context);
  }
  public override realise(element: NLGElement): NLGElement {
    let realisedElement: NLGElement | undefined;

    if (element instanceof InflectedWordElement) {
      realisedElement = this.doMorphology(element);
    } else if (element instanceof StringElement) {
      realisedElement = element;
    } else if (element instanceof WordElement) {
      // AG: now retrieves the default spelling variant, not the baseform
      // String baseForm = ((WordElement) element).getBaseForm();
      const defaultSpell = element.defaultSpellingVariant;

      if (defaultSpell !== undefined) {
        realisedElement = StringElement.fromString(defaultSpell, this.context);
      }
    } else if (element instanceof DocumentElement) {
      const children = element.getChildren();
      element.setComponents(this.realiseAll(children));
      realisedElement = element;
    } else if (element instanceof ListElement) {
      realisedElement = ListElement.create(
        RealisedCategory.REALISED_LIST,
        this.context,
      );
      (realisedElement as ListElement).addComponents(
        this.realiseAll(element.getChildren()),
      );
    } else if (element instanceof CoordinatedPhraseElement) {
      const children = element.getChildren();
      element.clearCoordinates();

      if (children.length > 0 && children[0] !== undefined) {
        element.addCoordinate(this.realise(children[0]));

        for (let index = 1; index < children.length; index++) {
          const child = children[index];
          if (child) element.addCoordinate(this.realise(child));
        }

        realisedElement = element;
      }
    }
    if (realisedElement === undefined) {
      realisedElement = element;
    }

    return realisedElement;
  }

  private doMorphology(element: InflectedWordElement): NLGElement {
    if (element.features[InternalFeature.NON_MORPH] === true) {
      const realisedElement = StringElement.fromString(
        element.baseForm,
        this.context,
      );
      const discFunc = element.features[InternalFeature.DISCOURSE_FUNCTION];
      if (discFunc) {
        realisedElement.features[InternalFeature.DISCOURSE_FUNCTION] = discFunc;
      }

      return realisedElement;
    } else {
      const baseWord = element.baseWord;

      const category = element.category;

      if (category instanceof LexicalCategory) {
        switch (category) {
          case LexicalCategory.PRONOUN:
            return MorphologyRules.doPronounMorphology(element);

          case LexicalCategory.NOUN:
            return MorphologyRules.doNounMorphology(element, baseWord);

          case LexicalCategory.VERB:
            return MorphologyRules.doVerbMorphology(element, baseWord);

          case LexicalCategory.ADJECTIVE:
            return MorphologyRules.doAdjectiveMorphology(element, baseWord);

          case LexicalCategory.ADVERB:
            return MorphologyRules.doAdverbMorphology(element, baseWord);
        }
      }

      const realisedElement = StringElement.fromString(
        // Conversion Note: Moved away from the LexicalCategory switch
        element.baseForm,
        this.context,
      );

      copyField(
        element.features,
        realisedElement.features,
        InternalFeature.DISCOURSE_FUNCTION,
        true,
      );

      return realisedElement;
    }
  }

  public override realiseAll(elements: NLGElement[]): NLGElement[] {
    const realisedElements: NLGElement[] = [];
    let currentElement: NLGElement | undefined;
    let determiner: NLGElement | undefined = undefined;
    let prevElement: NLGElement | undefined = undefined;

    for (const e of elements) {
      currentElement = this.realise(e);
      if (currentElement === undefined) {
        continue;
      }

      // pass the discourse function and appositive features -- important for orthography processor
      const apos = e.features[Feature.APPOSITIVE];
      if (apos) currentElement.features[Feature.APPOSITIVE] = apos;

      const func = e.features[InternalFeature.DISCOURSE_FUNCTION];
      if (func)
        currentElement.features[InternalFeature.DISCOURSE_FUNCTION] = func;

      if (
        prevElement !== undefined &&
        prevElement instanceof StringElement &&
        e instanceof InflectedWordElement &&
        e.category === LexicalCategory.NOUN
      ) {
        const prevString = prevElement.realisation;

        prevElement.realisation =
          DeterminerAgrHelper.checkEndsWithIndefiniteArticle(
            prevString,
            currentElement.realisation,
          );
      }

      realisedElements.push(currentElement);

      if (
        determiner === undefined &&
        DiscourseFunction.SPECIFIER ===
          currentElement.features[InternalFeature.DISCOURSE_FUNCTION]
      ) {
        determiner = currentElement;
        const num = e.features[Feature.NUMBER];
        if (num) determiner.features[Feature.NUMBER] = num;
      } else if (determiner !== undefined) {
        if (currentElement instanceof ListElement) {
          // list elements: ensure det matches first element
          const firstChild = currentElement.getChildren()[0];

          if (firstChild != null) {
            //AG: need to check if child is a coordinate
            if (firstChild instanceof CoordinatedPhraseElement) {
              MorphologyRules.doDeterminerMorphology(
                determiner,
                firstChild.getChildren()[0]?.realisation,
              );
            } else {
              MorphologyRules.doDeterminerMorphology(
                determiner,
                firstChild.realisation,
              );
            }
          }
        } else {
          // everything else: ensure det matches realisation
          MorphologyRules.doDeterminerMorphology(
            determiner,
            currentElement.realisation,
          );
        }
        determiner = undefined;
      }
      prevElement = e;
    }

    return realisedElements;
  }
}
