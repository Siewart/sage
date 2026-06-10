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
import { Form } from "../../features/Form.js";
import { InternalFeature } from "../../features/InternalFeature.js";
import { InterrogativeType } from "../../features/InterrogativeType.js";
import { NumberAgreement } from "../../features/NumberAgreement.js";
import { Tense } from "../../features/Tense.js";
import { CoordinatedPhraseElement } from "../../framework/CoordinatedPhraseElement.js";
import { NLGElement } from "../../framework/NLGElement.js";
import { InflectedWordElement } from "../../framework/InflectedWordElement.js";
import { LexicalCategory } from "../../framework/LexicalCategory.js";
import { ListElement } from "../../framework/ListElement.js";
import { PhraseCategory } from "../../framework/PhraseCategory.js";
import { PhraseElement } from "../../framework/PhraseElement.js";
import { RealisedCategory } from "../../framework/RealisedCategory.js";
import { StringElement } from "../../framework/StringElement.js";
import { WordElement } from "../../framework/WordElement.js";
import { SPhraseSpec } from "../../phrasespec/SPhraseSpec.js";
import { copyField } from "../../utils.js";
import { SyntaxProcessor } from "./SyntaxProcessor.js";
import { PhraseHelper } from "./PhraseHelper.js";

export abstract class VerbPhraseHelper {
  static realise(
    parent: SyntaxProcessor,
    phrase: PhraseElement,
  ): NLGElement | undefined {
    let realisedElement: ListElement | undefined;
    let vgComponents: NLGElement[] | undefined;
    const mainVerbRealisation: NLGElement[] = [];
    const auxiliaryRealisation: NLGElement[] = [];

    if (phrase) {
      vgComponents = this.createVerbGroup(phrase);
      this.splitVerbGroup(
        vgComponents,
        mainVerbRealisation,
        auxiliaryRealisation,
      );

      realisedElement = ListElement.create(
        RealisedCategory.REALISED_VERB_PHRASE,
        phrase.context,
      );

      if (
        !(InternalFeature.REALISE_AUXILIARY in phrase.features) || // Conversion note: fixed a more alarming copilot conversion issue where it was checking REALISE_AUXILIARY to either be false or true (rather than not being set or true), which is not amazing consistency, but still has a decently clear alternative in TS (could still be human error as well)
        phrase.features[InternalFeature.REALISE_AUXILIARY]
      ) {
        this.realiseAuxiliaries(parent, realisedElement, auxiliaryRealisation);

        PhraseHelper.realiseList(
          parent,
          realisedElement,
          phrase.getPreModifiers(),
          DiscourseFunction.PRE_MODIFIER,
        );

        this.realiseMainVerb(
          parent,
          phrase,
          mainVerbRealisation,
          realisedElement,
        );
      } else if (phrase.head && this.isCopular(phrase.head)) {
        this.realiseMainVerb(
          parent,
          phrase,
          mainVerbRealisation,
          realisedElement,
        );
        PhraseHelper.realiseList(
          parent,
          realisedElement,
          phrase.getPreModifiers(),
          DiscourseFunction.PRE_MODIFIER,
        );
      } else {
        PhraseHelper.realiseList(
          parent,
          realisedElement,
          phrase.getPreModifiers(),
          DiscourseFunction.PRE_MODIFIER,
        );
        this.realiseMainVerb(
          parent,
          phrase,
          mainVerbRealisation,
          realisedElement,
        );
      }

      this.realiseComplements(parent, phrase, realisedElement);
      PhraseHelper.realiseList(
        parent,
        realisedElement,
        phrase.getPostModifiers(),
        DiscourseFunction.POST_MODIFIER,
      );
    }

    return realisedElement;
  }

  private static realiseAuxiliaries(
    parent: SyntaxProcessor,
    realisedElement: ListElement,
    auxiliaryRealisation: NLGElement[],
  ): void {
    while (auxiliaryRealisation.length > 0) {
      const aux = auxiliaryRealisation.pop();
      if (!aux) continue;

      const currentElement = parent.realise(aux);
      if (currentElement) {
        realisedElement.addComponent(currentElement);
        currentElement.features[InternalFeature.DISCOURSE_FUNCTION] =
          DiscourseFunction.AUXILIARY;
      }
    }
  }

  private static realiseMainVerb(
    parent: SyntaxProcessor,
    phrase: PhraseElement,
    mainVerbRealisation: NLGElement[],
    realisedElement: ListElement,
  ): void {
    while (mainVerbRealisation.length > 0) {
      const main = mainVerbRealisation.pop();
      if (!main) continue;

      copyField(phrase.features, main.features, Feature.INTERROGATIVE_TYPE);
      const currentElement = parent.realise(main);

      if (currentElement) {
        realisedElement.addComponent(currentElement);
      }
    }
  }

  private static realiseComplements(
    parent: SyntaxProcessor,
    phrase: PhraseElement,
    realisedElement: ListElement,
  ): void {
    const indirects = ListElement.create(
      RealisedCategory.REALISED_INDIRECT_COMPLEMENT,
      phrase.context,
    );
    const directs = ListElement.create(
      RealisedCategory.REALISED_DIRECT_COMPLEMENT,
      phrase.context,
    );
    const unknowns = ListElement.create(
      RealisedCategory.REALISED_UNKNOWN_COMPLEMENT,
      phrase.context,
    );

    const complements = phrase.features[InternalFeature.COMPLEMENTS] ?? [];

    for (const complement of complements) {
      const discourseValue =
        complement.features[InternalFeature.DISCOURSE_FUNCTION];
      const currentElement = parent.realise(complement);

      if (currentElement) {
        currentElement.features[InternalFeature.DISCOURSE_FUNCTION] =
          DiscourseFunction.COMPLEMENT;

        if (discourseValue === DiscourseFunction.INDIRECT_OBJECT) {
          indirects.addComponent(currentElement);
        } else if (discourseValue === DiscourseFunction.OBJECT) {
          directs.addComponent(currentElement);
        } else {
          unknowns.addComponent(currentElement);
        }
      }
    }

    const interrogativeType = phrase.features[Feature.INTERROGATIVE_TYPE];
    if (!InterrogativeType.isIndirectObject(interrogativeType)) {
      realisedElement.addComponents(indirects.getChildren());
    }

    if (!phrase.features[Feature.PASSIVE]) {
      if (!InterrogativeType.isObject(interrogativeType)) {
        realisedElement.addComponents(directs.getChildren());
      }
      realisedElement.addComponents(unknowns.getChildren());
    }
  }

  private static splitVerbGroup(
    vgComponents: NLGElement[],
    mainVerbRealisation: NLGElement[],
    auxiliaryRealisation: NLGElement[],
  ): void {
    let mainVerbSeen = false;

    for (const word of vgComponents) {
      if (!mainVerbSeen) {
        mainVerbRealisation.push(word);
        if (!word.equals("not")) {
          // Coversion note: this only checks for realisation when passing a string, realisation is usually not set yet at this point in the realiser
          mainVerbSeen = true;
        }
      } else {
        auxiliaryRealisation.push(word);
      }
    }
  }

  private static createVerbGroup(phrase: PhraseElement): NLGElement[] {
    // TODO (later): WH_OBJ interogatives do not produce the correct phrase, we can do this here, but it requires some work
    let actualModal: string | undefined;
    const formValue = phrase.features[Feature.FORM];
    let tenseValue = phrase.features[Feature.TENSE];
    const modal = phrase.features[Feature.MODAL];
    let modalPast = false;
    const vgComponents: NLGElement[] = [];
    const interrogative = phrase.features[Feature.INTERROGATIVE_TYPE];

    if (formValue === Form.GERUND || formValue === Form.INFINITIVE) {
      tenseValue = Tense.PRESENT;
    }

    if (formValue === Form.INFINITIVE) {
      actualModal = "to";
    } else if (!formValue || formValue === Form.NORMAL) {
      if (
        tenseValue === Tense.FUTURE &&
        !modal &&
        (!(phrase.head instanceof CoordinatedPhraseElement) ||
          (phrase.head instanceof CoordinatedPhraseElement && interrogative))
      ) {
        actualModal = "will";
      } else if (modal) {
        actualModal = modal;
        if (tenseValue === Tense.PAST) {
          modalPast = true;
        }
      }
    }

    this.pushParticles(phrase, vgComponents);
    let frontVG: NLGElement | undefined = this.grabHeadVerb(
      phrase,
      modal !== undefined,
      tenseValue,
    );
    this.checkImperativeInfinitive(formValue, frontVG);

    if (phrase.features[Feature.PASSIVE]) {
      frontVG = this.addBe(
        frontVG,
        vgComponents,
        Form.PAST_PARTICIPLE,
        phrase.context,
      );
    }

    if (phrase.features[Feature.PROGRESSIVE]) {
      frontVG = this.addBe(
        frontVG,
        vgComponents,
        Form.PRESENT_PARTICIPLE,
        phrase.context,
      );
    }

    if (phrase.features[Feature.PERFECT] || modalPast) {
      frontVG = this.addHave(
        frontVG,
        vgComponents,
        modal,
        phrase.context,
        tenseValue,
      );
    }

    let frontVGEx = this.pushIfModal(
      actualModal !== undefined,
      phrase,
      frontVG,
      vgComponents,
    );
    frontVGEx = this.createNot(
      phrase,
      vgComponents,
      frontVGEx,
      modal !== undefined,
    );

    if (frontVGEx) {
      this.pushFrontVerb(
        phrase,
        vgComponents,
        frontVGEx,
        formValue,
        interrogative != undefined,
      );
    }

    this.pushModal(actualModal, phrase, vgComponents);
    return vgComponents;
  }

  private static pushModal(
    actualModal: string | undefined,
    phrase: PhraseElement,
    vgComponents: NLGElement[],
  ): void {
    if (actualModal && !phrase.features[InternalFeature.IGNORE_MODAL]) {
      vgComponents.push(
        InflectedWordElement.fromString(
          actualModal,
          LexicalCategory.MODAL,
          phrase.context,
        ),
      );
    }
  }

  private static pushFrontVerb(
    phrase: PhraseElement,
    vgComponents: NLGElement[],
    frontVG: NLGElement,
    formValue: Form | undefined,
    interrogative: boolean,
  ): void {
    const interrogType = phrase.features[Feature.INTERROGATIVE_TYPE];

    if (formValue === Form.GERUND) {
      frontVG.features[Feature.FORM] = Form.PRESENT_PARTICIPLE;
      vgComponents.push(frontVG);
    } else if (formValue === Form.PAST_PARTICIPLE) {
      frontVG.features[Feature.FORM] = Form.PAST_PARTICIPLE;
      vgComponents.push(frontVG);
    } else if (formValue === Form.PRESENT_PARTICIPLE) {
      frontVG.features[Feature.FORM] = Form.PRESENT_PARTICIPLE;
      vgComponents.push(frontVG);
    } else if (
      (!(formValue === undefined || formValue === Form.NORMAL) ||
        interrogative) &&
      !(phrase.head && this.isCopular(phrase.head)) &&
      vgComponents.length === 0
    ) {
      if (
        !(
          InterrogativeType.WHO_SUBJECT === interrogType ||
          InterrogativeType.WHAT_SUBJECT === interrogType
        )
      ) {
        frontVG.features[InternalFeature.NON_MORPH] = true;
      }

      vgComponents.push(frontVG);
    } else {
      const parent = phrase.parent;
      const numToUse = this.determineNumber(parent, phrase);

      const tense = phrase.features[Feature.TENSE];
      if (tense) {
        frontVG.features[Feature.TENSE] = tense;
      } else {
        delete frontVG.features[Feature.TENSE];
      }
      const person = phrase.features[Feature.PERSON];
      if (person) {
        frontVG.features[Feature.PERSON] = person;
      } else {
        delete frontVG.features[Feature.PERSON];
      }
      if (numToUse) {
        frontVG.features[Feature.NUMBER] = numToUse;
      } else {
        delete frontVG.features[Feature.NUMBER];
      }

      if (
        !(
          phrase.features[Feature.NEGATED] &&
          (InterrogativeType.WHO_OBJECT === interrogType ||
            InterrogativeType.WHAT_OBJECT === interrogType)
        )
      ) {
        vgComponents.push(frontVG);
      }
    }
  }

  private static createNot(
    phrase: PhraseElement,
    vgComponents: NLGElement[],
    frontVG: NLGElement | undefined,
    hasModal: boolean,
  ): NLGElement | undefined {
    let newFront = frontVG;

    if (phrase.features[Feature.NEGATED]) {
      const factory = phrase.context.factory;
      const interrType = phrase.features[Feature.INTERROGATIVE_TYPE];
      const addDo = !(
        InterrogativeType.WHAT_OBJECT === interrType ||
        InterrogativeType.WHO_OBJECT === interrType
      );

      if (vgComponents.length > 0 || (frontVG && this.isCopular(frontVG))) {
        vgComponents.push(
          InflectedWordElement.fromString(
            "not",
            LexicalCategory.ADVERB,
            phrase.context,
          ),
        );
      } else {
        if (frontVG && !hasModal) {
          frontVG.features[Feature.NEGATED] = true;
          vgComponents.push(frontVG);
        }

        vgComponents.push(
          InflectedWordElement.fromString(
            "not",
            LexicalCategory.ADVERB,
            phrase.context,
          ),
        );

        if (addDo) {
          if (factory) {
            newFront = factory.createInflectedWord("do", LexicalCategory.VERB);
          } else {
            newFront = InflectedWordElement.fromString(
              "do",
              LexicalCategory.VERB,
              phrase.context,
            );
          }
        }
      }
    }

    return newFront;
  }

  private static pushIfModal(
    hasModal: boolean,
    phrase: PhraseElement,
    frontVG: NLGElement | undefined,
    vgComponents: NLGElement[],
  ): NLGElement | undefined {
    let newFront: NLGElement | undefined = frontVG;
    if (hasModal && !phrase.features[InternalFeature.IGNORE_MODAL]) {
      if (frontVG) {
        frontVG.features[InternalFeature.NON_MORPH] = true;
        vgComponents.push(frontVG);
      }
      newFront = undefined;
    }
    return newFront;
  }

  private static addHave(
    frontVG: NLGElement | undefined,
    vgComponents: NLGElement[],
    modal: string | undefined,
    context: NLGContext,
    tenseValue?: Tense,
  ): NLGElement | undefined {
    if (!frontVG) return frontVG;
    frontVG.features[Feature.FORM] = Form.PAST_PARTICIPLE;
    vgComponents.push(frontVG);
    const newFront = InflectedWordElement.fromString(
      "have",
      LexicalCategory.VERB,
      context,
    );
    if (tenseValue) {
      newFront.features[Feature.TENSE] = tenseValue;
    }
    if (modal) {
      newFront.features[InternalFeature.NON_MORPH] = true;
    }
    return newFront;
  }

  private static addBe(
    frontVG: NLGElement | undefined,
    vgComponents: NLGElement[],
    frontForm: Form,
    context: NLGContext,
  ): NLGElement {
    if (frontVG) {
      frontVG.features[Feature.FORM] = frontForm;
      vgComponents.push(frontVG);
    }
    return InflectedWordElement.fromString("be", LexicalCategory.VERB, context);
  }

  private static checkImperativeInfinitive(
    formValue: Form | undefined,
    frontVG: NLGElement | undefined,
  ): void {
    if (
      (formValue === Form.IMPERATIVE ||
        formValue === Form.INFINITIVE ||
        formValue === Form.BARE_INFINITIVE) &&
      frontVG
    ) {
      frontVG.features[InternalFeature.NON_MORPH] = true;
    }
  }

  private static grabHeadVerb(
    phrase: PhraseElement,
    hasModal: boolean,
    tenseValue?: Tense,
  ): NLGElement | undefined {
    let frontVG = phrase.head;

    if (frontVG instanceof WordElement) {
      frontVG = InflectedWordElement.fromWordElement(frontVG, phrase.context);
    }
    if (tenseValue && frontVG) {
      frontVG.features[Feature.TENSE] = tenseValue;
    }
    if (hasModal && frontVG) {
      frontVG.features[Feature.NEGATED] = false;
    }

    return frontVG;
  }
  private static pushParticles(
    phrase: PhraseElement,
    vgComponents: NLGElement[],
  ): void {
    const particle = phrase.features[Feature.PARTICLE];

    if (typeof particle === "string") {
      vgComponents.push(StringElement.fromString(particle, phrase.context));
    }
  }

  private static determineNumber(
    parent: NLGElement | undefined,
    phrase: PhraseElement,
  ): NumberAgreement {
    const numberValue = phrase.features[Feature.NUMBER];
    let number: NumberAgreement;
    if (numberValue && numberValue instanceof NumberAgreement) {
      number = numberValue;
    } else {
      number = NumberAgreement.SINGULAR;
    }
    if (parent instanceof PhraseElement) {
      if (
        parent.isA(PhraseCategory.CLAUSE) &&
        (PhraseHelper.isExpletiveSubject(parent) ||
          InterrogativeType.WHO_SUBJECT ===
            parent.features[Feature.INTERROGATIVE_TYPE] ||
          InterrogativeType.WHAT_SUBJECT ===
            parent.features[Feature.INTERROGATIVE_TYPE]) &&
        phrase.head &&
        this.isCopular(phrase.head)
      ) {
        const list = phrase.features[InternalFeature.COMPLEMENTS];
        if (list && this.hasPluralComplement(list)) {
          number = NumberAgreement.PLURAL;
        } else {
          number = NumberAgreement.SINGULAR;
        }
      }
    }
    return number;
  }

  private static hasPluralComplement(complements: NLGElement[]): boolean {
    let plural = false;
    for (const eachComplement of complements) {
      if (eachComplement && eachComplement.isA(PhraseCategory.NOUN_PHRASE)) {
        const numberValue = eachComplement.features[Feature.NUMBER];
        if (numberValue && NumberAgreement.PLURAL === numberValue) {
          plural = true;
          break;
        }
      }
    }
    return plural;
  }

  public static isCopular(element: NLGElement): boolean {
    let copular = false;

    if (element instanceof InflectedWordElement) {
      copular = element.baseForm?.toLowerCase() === "be";
    } else if (element instanceof WordElement) {
      copular = element.baseForm.toLowerCase() === "be";
    } else if (element instanceof PhraseElement) {
      const head = element instanceof SPhraseSpec ? element.verb : element.head;

      if (head) {
        copular = head instanceof WordElement && "be" === head.baseForm;
      }
    }

    return copular;
  }
}
