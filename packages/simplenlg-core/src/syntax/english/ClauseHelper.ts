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

import { ClauseStatus } from "../../features/ClauseStatus.js";
import { DiscourseFunction } from "../../features/DiscourseFunction.js";
import { Feature } from "../../features/Feature.js";
import { Form } from "../../features/Form.js";
import { InternalFeature } from "../../features/InternalFeature.js";
import { InterrogativeType } from "../../features/InterrogativeType.js";
import { NumberAgreement } from "../../features/NumberAgreement.js";
import { Person } from "../../features/Person.js";
import { Tense } from "../../features/Tense.js";
import { CoordinatedPhraseElement } from "../../framework/CoordinatedPhraseElement.js";
import { NLGElement } from "../../framework/NLGElement.js";
import { LexicalCategory } from "../../framework/LexicalCategory.js";
import { ListElement } from "../../framework/ListElement.js";
import { PhraseCategory } from "../../framework/PhraseCategory.js";
import { PhraseElement } from "../../framework/PhraseElement.js";
import { RealisedCategory } from "../../framework/RealisedCategory.js";
import { SPhraseSpec } from "../../phrasespec/SPhraseSpec.js";
import { VPPhraseSpec } from "../../phrasespec/VPPhraseSpec.js";
import { copyField } from "../../utils.js";
import { SyntaxProcessor } from "./SyntaxProcessor.js";
import { PhraseHelper } from "./PhraseHelper.js";
import { VerbPhraseHelper } from "./VerbPhraseHelper.js";

export abstract class ClauseHelper {
  public static realise(
    parent: SyntaxProcessor,
    phrase: PhraseElement,
  ): NLGElement | undefined {
    let splitVerb: NLGElement | undefined;
    let interrogObj = false;

    const realisedElement = ListElement.create(
      RealisedCategory.REALISED_CLAUSE,
      parent.context,
    );
    let verbElement = phrase.features[InternalFeature.VERB_PHRASE];

    if (verbElement === undefined) {
      verbElement = phrase.head;
    }

    this.checkSubjectNumberPerson(phrase, verbElement);
    this.checkDiscourseFunction(phrase);
    this.copyFrontModifiers(phrase, verbElement);
    this.addComplementiser(phrase, parent, realisedElement);
    this.addCuePhrase(phrase, parent, realisedElement);

    const interrogativeType = phrase.features[Feature.INTERROGATIVE_TYPE];
    if (interrogativeType !== undefined) {
      interrogObj =
        interrogativeType === InterrogativeType.WHAT_OBJECT ||
        interrogativeType === InterrogativeType.WHO_OBJECT ||
        interrogativeType === InterrogativeType.HOW_PREDICATE ||
        interrogativeType === InterrogativeType.HOW ||
        interrogativeType === InterrogativeType.WHY ||
        interrogativeType === InterrogativeType.WHERE;

      splitVerb = this.realiseInterrogative(
        phrase,
        parent,
        realisedElement,
        verbElement,
      );
    } else if (phrase.features[Feature.EXCLAMATORY]) {
      if (phrase.parent != null) {
        phrase.parent.features[Feature.EXCLAMATORY] = true;
      }
    } else {
      PhraseHelper.realiseList(
        parent,
        realisedElement,
        phrase.features[InternalFeature.FRONT_MODIFIERS] ?? [],
        DiscourseFunction.FRONT_MODIFIER,
      );
    }

    this.addSubjectsToFront(phrase, parent, realisedElement, splitVerb);

    const passiveSplitVerb = this.addPassiveComplementsNumberPerson(
      phrase,
      parent,
      realisedElement,
      verbElement,
    );

    if (passiveSplitVerb !== undefined) {
      splitVerb = passiveSplitVerb;
    }

    this.realiseVerb(
      parent,
      realisedElement,
      splitVerb,
      verbElement,
      interrogObj,
    );
    this.addPassiveSubjects(phrase, parent, realisedElement);
    this.addInterrogativeFrontModifiers(phrase, parent, realisedElement);
    this.addEndingTo(phrase, parent, realisedElement);

    return realisedElement;
  }

  private static addEndingTo(
    phrase: PhraseElement,
    parent: SyntaxProcessor,
    realisedElement: ListElement,
  ): void {
    if (
      phrase.features[Feature.INTERROGATIVE_TYPE] ===
      InterrogativeType.WHO_INDIRECT_OBJECT
    ) {
      const word = parent.context.factory.createWord(
        "to",
        LexicalCategory.PREPOSITION,
      );
      const realised = parent.realise(word);
      if (realised) realisedElement.addComponent(realised);
    }
  }

  private static addInterrogativeFrontModifiers(
    phrase: PhraseElement,
    parent: SyntaxProcessor,
    realisedElement: ListElement,
  ): void {
    let currentElement: NLGElement | undefined;

    if (phrase.features[Feature.INTERROGATIVE_TYPE] !== undefined) {
      for (const subject of phrase?.features[InternalFeature.FRONT_MODIFIERS] ??
        []) {
        currentElement = parent.realise(subject);
        if (currentElement !== undefined) {
          currentElement.features[InternalFeature.DISCOURSE_FUNCTION] =
            DiscourseFunction.FRONT_MODIFIER;
          realisedElement.addComponent(currentElement);
        }
      }
    }
  }

  private static addPassiveSubjects(
    phrase: PhraseElement,
    parent: SyntaxProcessor,
    realisedElement: ListElement,
  ): void {
    let currentElement: NLGElement | undefined;

    if (phrase.features[Feature.PASSIVE] === true) {
      const allSubjects = phrase.features[InternalFeature.SUBJECTS] ?? [];

      if (
        allSubjects.length > 0 ||
        phrase.features[Feature.INTERROGATIVE_TYPE] !== undefined
      ) {
        const prepPhrase = parent.realise(
          parent.context.factory.createPrepositionPhrase("by"),
        );
        if (prepPhrase) realisedElement.addComponent(prepPhrase);
      }

      for (const subject of allSubjects) {
        subject.features[Feature.PASSIVE] = true;
        if (
          subject.isA(PhraseCategory.NOUN_PHRASE) ||
          subject instanceof CoordinatedPhraseElement
        ) {
          currentElement = parent.realise(subject);
          if (currentElement !== undefined) {
            currentElement.features[InternalFeature.DISCOURSE_FUNCTION] =
              DiscourseFunction.SUBJECT;
            realisedElement.addComponent(currentElement);
          }
        }
      }
    }
  }

  private static realiseVerb(
    parent: SyntaxProcessor,
    realisedElement: ListElement,
    splitVerb: NLGElement | undefined,
    verbElement: NLGElement | undefined,
    whObj: boolean,
  ): void {
    let currentElement = verbElement ? parent.realise(verbElement) : undefined;
    if (currentElement !== undefined) {
      if (splitVerb === undefined) {
        currentElement.features[InternalFeature.DISCOURSE_FUNCTION] =
          DiscourseFunction.VERB_PHRASE;
        realisedElement.addComponent(currentElement);
      } else {
        if (currentElement instanceof ListElement) {
          const children = currentElement.getChildren();
          currentElement = children[0];
          if (currentElement) {
            currentElement.features[InternalFeature.DISCOURSE_FUNCTION] =
              DiscourseFunction.VERB_PHRASE;
            realisedElement.addComponent(currentElement);
          }
          realisedElement.addComponent(splitVerb);

          for (let eachChild = 1; eachChild < children.length; eachChild++) {
            currentElement = children[eachChild];
            if (currentElement) {
              currentElement.features[InternalFeature.DISCOURSE_FUNCTION] =
                DiscourseFunction.VERB_PHRASE;
              realisedElement.addComponent(currentElement);
            }
          }
        } else {
          currentElement.features[InternalFeature.DISCOURSE_FUNCTION] =
            DiscourseFunction.VERB_PHRASE;

          if (whObj) {
            realisedElement.addComponent(currentElement);
            realisedElement.addComponent(splitVerb);
          } else {
            realisedElement.addComponent(splitVerb);
            realisedElement.addComponent(currentElement);
          }
        }
      }
    }
  }

  private static addPassiveComplementsNumberPerson(
    phrase: PhraseElement,
    parent: SyntaxProcessor,
    realisedElement: ListElement,
    verbElement: NLGElement | undefined,
  ): NLGElement | undefined {
    let currentElement: NLGElement | undefined = undefined;
    let splitVerb: NLGElement | undefined = undefined;
    const verbPhrase = phrase.features[InternalFeature.VERB_PHRASE];

    // count complements to set plural feature if more than one
    let numComps = 0;
    let coordSubj = false;
    let passiveNumber: NumberAgreement | undefined = undefined;
    let passivePerson: Person | undefined = undefined;
    if (
      phrase.features[Feature.PASSIVE] &&
      verbPhrase !== undefined &&
      InterrogativeType.WHAT_OBJECT !==
        phrase.features[Feature.INTERROGATIVE_TYPE]
    ) {
      // complements of a clause are stored in the VPPhraseSpec
      for (const subject of verbPhrase?.features[InternalFeature.COMPLEMENTS] ??
        []) {
        // AG: complement needn't be an NP
        // subject.isA(PhraseCategory.NOUN_PHRASE) &&
        if (
          DiscourseFunction.OBJECT ===
          subject.features[InternalFeature.DISCOURSE_FUNCTION]
        ) {
          subject.features[Feature.PASSIVE] = true;
          numComps++;
          currentElement = parent.realise(subject);

          if (currentElement !== undefined) {
            currentElement.features[InternalFeature.DISCOURSE_FUNCTION] =
              DiscourseFunction.OBJECT;

            if (phrase.features[Feature.INTERROGATIVE_TYPE]) {
              splitVerb = currentElement;
            } else {
              realisedElement.addComponent(currentElement);
            }
          }

          // flag if passive subject is coordinated with an "and"
          if (!coordSubj && subject instanceof CoordinatedPhraseElement) {
            const conj = subject.conjunction;
            coordSubj = conj !== undefined && conj === "and";
          }

          if (passiveNumber === undefined) {
            passiveNumber = subject.features[Feature.NUMBER];
          } else {
            passiveNumber = NumberAgreement.PLURAL;
          }

          if (Person.FIRST === subject.features[Feature.PERSON]) {
            passivePerson = Person.FIRST;
          } else if (
            Person.SECOND === subject.features[Feature.PERSON] &&
            Person.FIRST !== passivePerson
          ) {
            passivePerson = Person.SECOND;
          } else if (passivePerson === undefined) {
            passivePerson = Person.THIRD;
          }

          if (
            Form.GERUND === phrase.features[Feature.FORM] &&
            !phrase.features[Feature.SUPPRESS_GENITIVE_IN_GERUND]
          ) {
            subject.features[Feature.POSSESSIVE] = true;
          }
        }
      }
    }

    if (verbElement !== undefined) {
      if (passivePerson !== undefined) {
        verbElement.features[Feature.PERSON] = passivePerson;
      }

      if (numComps > 1 || coordSubj) {
        verbElement.features[Feature.NUMBER] = NumberAgreement.PLURAL;
      } else if (passiveNumber != undefined) {
        verbElement.features[Feature.NUMBER] = passiveNumber;
      }
    }
    return splitVerb;
  }

  private static addSubjectsToFront(
    phrase: PhraseElement,
    parent: SyntaxProcessor,
    realisedElement: ListElement,
    splitVerb: NLGElement | undefined,
  ): void {
    if (
      phrase.features[Feature.FORM] !== Form.INFINITIVE &&
      phrase.features[Feature.FORM] !== Form.IMPERATIVE &&
      !phrase.features[Feature.PASSIVE] &&
      splitVerb === undefined
    ) {
      realisedElement.addComponents(
        this.realiseSubjects(phrase, parent).getChildren(),
      );
    }
  }

  private static realiseSubjects(
    phrase: PhraseElement,
    parent: SyntaxProcessor,
  ): ListElement {
    let currentElement: NLGElement | undefined = undefined;
    const realisedElement = ListElement.create(
      RealisedCategory.REALISED_SUBJECTS,
      parent.context,
    );

    for (const subject of phrase.features[InternalFeature.SUBJECTS] ?? []) {
      subject.features[InternalFeature.DISCOURSE_FUNCTION] =
        DiscourseFunction.SUBJECT;
      if (
        phrase.features[Feature.FORM] === Form.GERUND &&
        !phrase.features[Feature.SUPPRESS_GENITIVE_IN_GERUND]
      ) {
        subject.features[Feature.POSSESSIVE] = true;
      }
      currentElement = parent.realise(subject);
      if (currentElement !== undefined) {
        realisedElement.addComponent(currentElement);
      }
    }
    return realisedElement;
  }

  private static realiseInterrogative(
    phrase: PhraseElement,
    parent: SyntaxProcessor,
    realisedElement: ListElement,
    verbElement: NLGElement | undefined,
  ): NLGElement | undefined {
    let splitVerb: NLGElement | undefined = undefined;

    if (phrase.parent != undefined) {
      phrase.parent.features[InternalFeature.INTERROGATIVE] = true;
    }

    const type = phrase.features[Feature.INTERROGATIVE_TYPE];

    if (type instanceof InterrogativeType) {
      switch (type) {
        case InterrogativeType.YES_NO:
          splitVerb = this.realiseYesNo(
            phrase,
            parent,
            verbElement,
            realisedElement,
          );
          break;

        case InterrogativeType.WHO_SUBJECT:
        case InterrogativeType.WHAT_SUBJECT:
          this.realiseInterrogativeKeyWord(
            type.getString(),
            LexicalCategory.PRONOUN,
            parent,
            realisedElement,
          );
          delete phrase.features[InternalFeature.SUBJECTS];
          break;

        case InterrogativeType.HOW_MANY:
          this.realiseInterrogativeKeyWord(
            "how",
            LexicalCategory.PRONOUN,
            parent,
            realisedElement,
          );
          this.realiseInterrogativeKeyWord(
            "many",
            LexicalCategory.ADVERB,
            parent,
            realisedElement,
          );
          break;

        case InterrogativeType.HOW:
        case InterrogativeType.WHY:
        case InterrogativeType.WHERE:
        case InterrogativeType.WHO_OBJECT:
        case InterrogativeType.WHO_INDIRECT_OBJECT:
        case InterrogativeType.WHAT_OBJECT:
          splitVerb = this.realiseObjectWHInterrogative(
            type.getString(),
            phrase,
            parent,
            realisedElement,
          );
          break;

        case InterrogativeType.HOW_PREDICATE:
          splitVerb = this.realiseObjectWHInterrogative(
            "how",
            phrase,
            parent,
            realisedElement,
          );
          break;

        default:
          break;
      }
    }

    return splitVerb;
  }

  private static hasAuxiliary(phrase: PhraseElement): boolean {
    return (
      (phrase.features[Feature.MODAL] != undefined &&
        phrase.features[Feature.MODAL] !== "") ||
      phrase.features[Feature.PERFECT] ||
      phrase.features[Feature.PROGRESSIVE] ||
      phrase.features[Feature.TENSE] === Tense.FUTURE
    );
  }

  private static realiseObjectWHInterrogative(
    keyword: string,
    phrase: PhraseElement,
    parent: SyntaxProcessor,
    realisedElement: ListElement,
  ): NLGElement | undefined {
    let splitVerb: NLGElement | undefined = undefined;
    this.realiseInterrogativeKeyWord(
      keyword,
      LexicalCategory.PRONOUN,
      parent,
      realisedElement,
    );

    if (!this.hasAuxiliary(phrase) && !VerbPhraseHelper.isCopular(phrase)) {
      this.addDoAuxiliary(phrase, parent, realisedElement);
    } else if (!phrase.features[Feature.PASSIVE]) {
      splitVerb = this.realiseSubjects(phrase, parent);
    }

    return splitVerb;
  }

  private static addDoAuxiliary(
    phrase: PhraseElement,
    parent: SyntaxProcessor,
    realisedElement: ListElement,
  ): void {
    const doPhrase = parent.context.factory.createVerbPhrase("do");
    copyField(phrase.features, doPhrase.features, Feature.TENSE, true);
    copyField(phrase.features, doPhrase.features, Feature.PERSON, true);
    copyField(phrase.features, doPhrase.features, Feature.NUMBER, true);
    const realised = parent.realise(doPhrase);
    if (realised) realisedElement.addComponent(realised);
  }

  private static realiseInterrogativeKeyWord(
    keyWord: string | undefined,
    cat: LexicalCategory,
    parent: SyntaxProcessor,
    realisedElement: ListElement,
  ): void {
    if (keyWord !== undefined) {
      const question = realisedElement.context.factory.createWord(keyWord, cat);
      const currentElement = parent.realise(question);

      if (currentElement !== undefined) {
        realisedElement.addComponent(currentElement);
      }
    }
  }

  private static realiseYesNo(
    phrase: PhraseElement,
    parent: SyntaxProcessor,
    verbElement: NLGElement | undefined,
    realisedElement: ListElement,
  ): NLGElement | undefined {
    let splitVerb: NLGElement | undefined = undefined;

    if (
      !(
        verbElement instanceof VPPhraseSpec &&
        verbElement.verb != undefined &&
        VerbPhraseHelper.isCopular(verbElement.verb)
      ) &&
      !phrase.features[Feature.PROGRESSIVE] &&
      !phrase.features[Feature.MODAL] &&
      phrase.features[Feature.TENSE] !== Tense.FUTURE &&
      !phrase.features[Feature.NEGATED] &&
      !phrase.features[Feature.PASSIVE]
    ) {
      this.addDoAuxiliary(phrase, parent, realisedElement);
    } else {
      splitVerb = this.realiseSubjects(phrase, parent);
    }
    return splitVerb;
  }

  private static addCuePhrase(
    phrase: PhraseElement,
    parent: SyntaxProcessor,
    realisedElement: ListElement,
  ): void {
    const element = phrase.features[Feature.CUE_PHRASE];
    const currentElement = element ? parent.realise(element) : undefined;

    if (currentElement !== undefined) {
      currentElement.features[InternalFeature.DISCOURSE_FUNCTION] =
        DiscourseFunction.CUE_PHRASE;
      realisedElement.addComponent(currentElement);
    }
  }

  private static addComplementiser(
    phrase: PhraseElement,
    parent: SyntaxProcessor,
    realisedElement: ListElement,
  ): void {
    let currentElement: NLGElement | undefined;

    if (
      phrase.features[InternalFeature.CLAUSE_STATUS] ===
        ClauseStatus.SUBORDINATE &&
      !phrase.features[Feature.SUPRESSED_COMPLEMENTISER]
    ) {
      const complementiser = phrase.features[Feature.COMPLEMENTISER];
      currentElement = complementiser
        ? parent.realise(complementiser)
        : undefined;

      if (currentElement !== undefined) {
        realisedElement.addComponent(currentElement);
      }
    }
  }

  private static copyFrontModifiers(
    phrase: PhraseElement,
    verbElement: NLGElement | undefined,
  ): void {
    const frontModifiers = phrase.features[InternalFeature.FRONT_MODIFIERS];
    const clauseForm = phrase.features[Feature.FORM];

    if (verbElement !== undefined) {
      const phrasePostModifiers =
        phrase.features[InternalFeature.POSTMODIFIERS];

      if (verbElement instanceof PhraseElement) {
        const verbPostModifiers =
          verbElement.features[InternalFeature.POSTMODIFIERS] ?? [];

        for (const eachModifier of phrasePostModifiers ?? []) {
          if (!verbPostModifiers.includes(eachModifier)) {
            verbElement.addPostModifier(eachModifier);
          }
        }
      }
    }

    if (clauseForm === Form.INFINITIVE) {
      phrase.features[Feature.SUPRESSED_COMPLEMENTISER] = true;

      for (const eachModifier of frontModifiers ?? []) {
        if (verbElement instanceof PhraseElement) {
          verbElement.addPostModifier(eachModifier);
        }
      }
      delete phrase.features[InternalFeature.FRONT_MODIFIERS];
      if (verbElement !== undefined) {
        verbElement.features[InternalFeature.NON_MORPH] = true;
      }
    }
  }

  private static checkDiscourseFunction(phrase: PhraseElement): void {
    const subjects = phrase.features[InternalFeature.SUBJECTS];
    const clauseForm = phrase.features[Feature.FORM];
    const discourseValue = phrase.features[InternalFeature.DISCOURSE_FUNCTION];

    if (
      discourseValue === DiscourseFunction.OBJECT ||
      discourseValue === DiscourseFunction.INDIRECT_OBJECT
    ) {
      if (clauseForm === Form.IMPERATIVE) {
        phrase.features[Feature.SUPRESSED_COMPLEMENTISER] = true;
        phrase.features[Feature.FORM] = Form.INFINITIVE;
      } else if (clauseForm === Form.GERUND && (subjects?.length ?? 0) === 0) {
        phrase.features[Feature.SUPRESSED_COMPLEMENTISER] = true;
      }
    } else if (discourseValue === DiscourseFunction.SUBJECT) {
      phrase.features[Feature.FORM] = Form.GERUND;
      phrase.features[Feature.SUPRESSED_COMPLEMENTISER] = true;
    }
  }

  private static checkSubjectNumberPerson(
    phrase: PhraseElement,
    verbElement: NLGElement | undefined,
  ): void {
    let currentElement: NLGElement | undefined = undefined;
    const subjects = phrase.features[InternalFeature.SUBJECTS];
    let pluralSubjects = false;
    let person: Person | undefined = undefined;

    if (subjects !== undefined) {
      switch (subjects.length) {
        case 0:
          break;

        case 1:
          currentElement = subjects[0];
          // coordinated NP with "and" are plural (not coordinated NP with "or")
          if (
            currentElement instanceof CoordinatedPhraseElement &&
            currentElement.plural
          ) {
            pluralSubjects = true; // TODO (Debug): this should be using a separate method
          } else if (
            currentElement?.features[Feature.NUMBER] ===
              NumberAgreement.PLURAL &&
            !(currentElement instanceof SPhraseSpec)
          ) {
            pluralSubjects = true;
          } else if (currentElement?.isA(PhraseCategory.NOUN_PHRASE)) {
            const currentHead = currentElement.features[InternalFeature.HEAD];
            person = currentElement.features[Feature.PERSON];

            if (currentHead === undefined) {
              pluralSubjects = false;
            } else if (
              currentHead.features[Feature.NUMBER] === NumberAgreement.PLURAL
            ) {
              pluralSubjects = true;
            } else if (currentHead instanceof ListElement) {
              pluralSubjects = true;
            }
          }
          break;

        default:
          pluralSubjects = true;
          break;
      }
    }

    if (verbElement !== undefined) {
      verbElement.features[Feature.NUMBER] = pluralSubjects
        ? NumberAgreement.PLURAL
        : (phrase.features[Feature.NUMBER] ?? NumberAgreement.SINGULAR);
      if (person !== undefined) {
        verbElement.features[Feature.PERSON] = person;
      }
    }
  }
}
