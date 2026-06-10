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
import { Feature } from "../../features/Feature.js";
import { CoordinatedPhraseElement } from "../../framework/CoordinatedPhraseElement.js";
import { DocumentElement } from "../../framework/DocumentElement.js";
import { NLGElement } from "../../framework/NLGElement.js";
import { InflectedWordElement } from "../../framework/InflectedWordElement.js";
import { ListElement } from "../../framework/ListElement.js";
import { NLGModule } from "../../framework/NLGModule.js";
import { PhraseCategory } from "../../framework/PhraseCategory.js";
import { PhraseElement } from "../../framework/PhraseElement.js";
import { RealisedCategory } from "../../framework/RealisedCategory.js";
import { WordElement } from "../../framework/WordElement.js";
import { cloneInto } from "../../utils.js";
import { ClauseHelper } from "./ClauseHelper.js";
import { CoordinatedPhraseHelper } from "./CoordinatedPhraseHelper.js";
import { NounPhraseHelper } from "./NounPhraseHelper.js";
import { PhraseHelper } from "./PhraseHelper.js";
import { VerbPhraseHelper } from "./VerbPhraseHelper.js";

export class SyntaxProcessor extends NLGModule {
  public static create(context: NLGContext): SyntaxProcessor {
    return new SyntaxProcessor(context);
  }
  public override realise(element: NLGElement): NLGElement {
    if (element.features[Feature.ELIDED]) {
      const result = this.context.getEmpty("Elided Element");
      result.features[Feature.ELIDED] = true;
      return result;
    }

    let realisedElement: NLGElement | undefined;

    if (element instanceof DocumentElement) {
      const children = element.getChildren();
      element.components = this.realiseAll(children);
      realisedElement = element;
    } else if (element instanceof PhraseElement) {
      realisedElement = this.realisePhraseElement(element);
    } else if (element instanceof ListElement) {
      realisedElement = ListElement.create(
        RealisedCategory.REALISED_LIST,
        this.context,
      );
      (realisedElement as ListElement).addComponents(
        this.realiseAll(element.getChildren()) ?? [],
      );
    } else if (element instanceof InflectedWordElement) {
      const word = element.baseWord;
      element.baseWord = word;
      realisedElement = element;
    } else if (element instanceof WordElement) {
      const infl = InflectedWordElement.fromWordElement(element, this.context);

      cloneInto(element.features, infl.features, false);
      realisedElement = this.realise(infl);
    } else if (element instanceof CoordinatedPhraseElement) {
      realisedElement = CoordinatedPhraseHelper.realise(this, element);
    } else {
      realisedElement = element;
    }

    if (realisedElement instanceof ListElement && realisedElement.size === 1) {
      realisedElement = realisedElement.first;
    }

    if (realisedElement === undefined) {
      console.error(
        "Realised element is undefined in SyntaxProcessor:realise. Returning original element",
      );
    }
    return realisedElement ?? element;
  }

  public override realiseAll(elements: NLGElement[]): NLGElement[] {
    const realisedList: NLGElement[] = [];

    for (const element of elements) {
      const childRealisation = this.realise(element);
      if (!childRealisation) continue;

      if (childRealisation instanceof ListElement) {
        realisedList.push(...childRealisation.getChildren());
      } else {
        realisedList.push(childRealisation);
      }
    }

    return realisedList;
  }

  private realisePhraseElement(phrase: PhraseElement): NLGElement | undefined {
    const category = phrase.category;
    if (!(category instanceof PhraseCategory)) return undefined;

    switch (category) {
      case PhraseCategory.CLAUSE:
        return ClauseHelper.realise(this, phrase);
      case PhraseCategory.NOUN_PHRASE:
        return NounPhraseHelper.realise(this, phrase);
      case PhraseCategory.VERB_PHRASE:
        return VerbPhraseHelper.realise(this, phrase);
      case PhraseCategory.PREPOSITIONAL_PHRASE:
      case PhraseCategory.ADJECTIVE_PHRASE:
      case PhraseCategory.ADVERB_PHRASE:
        return PhraseHelper.realise(this, phrase);
      default:
        return phrase;
    }
  }
}
