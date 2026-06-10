import {
  ClauseStatusValues,
  DiscourseFunctionValues,
  FormValues,
  GenderValues,
  InflectionValues,
  InterrogativeTypeValues,
  NumberAgreementValues,
  PersonValues,
  TenseValues,
} from "simplenlg-core/features";
import {
  LexicalCategoryValues,
  DocumentCategoryValues,
  PhraseCategoryValues,
} from "simplenlg-core/framework";
import { SomeZodObject, z } from "zod";

// General note:
// Due to circular dependencies and refinement this types and their assigned values are not automatically checked
// Please modify with utmost care

// Currently we may have overdone the amount of ZodTypes, perhaps we can simplify further

export const upperCase = (val: unknown) =>
  typeof val === "string"
    ? val.toUpperCase()
    : val === undefined
      ? undefined
      : null;
const fromXMLTextOptional = <EnumT extends [string, ...string[]]>(
  validation: z.ZodEnum<EnumT> | z.ZodString = z.string(),
) => z.object({ ["#text"]: validation }).transform((x) => x["#text"]);

export const fromXMLText = <EnumT extends [string, ...string[]]>(
  validation: z.ZodEnum<EnumT> | z.ZodString = z.string(),
) =>
  fromXMLTextOptional(validation).refine(
    (val): val is NonNullable<typeof val> => val !== undefined,
    {
      message: "Value is required.",
    },
  );

const withAttributes = <A extends z.SomeZodObject>(object: A): Attribute<A> => {
  const allOptional = Object.values(object.shape).every((value) => {
    return value.isOptional();
  });

  if (allOptional) {
    return {
      "#attr": object.optional(),
    } as Attribute<A>;
  } else {
    return {
      "#attr": object,
    } as Attribute<A>; // TS's error isn't very clear, but I cannot find a mistake right now so just using "as" for now, especially since we do programmatical optional checking which may confuse the type checker
  }
};

type IsZodOptional<T> = T extends z.ZodOptional<z.ZodType> ? true : false;

type Attribute<A extends SomeZodObject, K extends string = "#attr"> = {
  [a in keyof A["shape"]]: IsZodOptional<A["shape"][a]>;
}[keyof A["shape"]] extends true
  ? { [k in K]: z.ZodOptional<A> }
  : {
      [k in K]: A;
    };

const withTypeAndAttributes = <
  const Type extends string,
  A extends z.SomeZodObject = z.ZodObject<{ [k in string]: z.ZodTypeAny }>,
>(
  type: Type,
  object: A,
): TypedAttribute<Type, A["shape"]> => {
  return {
    "#attr": z
      .object({
        type: z.literal(type),
      })
      .merge(object),
  };
};

type TypedAttribute<
  T extends string,
  A extends { [k in string]: z.ZodTypeAny } = Record<string, z.ZodTypeAny>,
  K extends string = "#attr",
> = {
  [k in K]: z.ZodObject<{ type: z.ZodLiteral<T> } & { [X in keyof A]: A[X] }>;
};

const booleanFromString = z.preprocess((val) => {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") {
    if (val.toLowerCase() === "true") return true;
    if (val.toLowerCase() === "false") return false;
  }
  return val;
}, z.boolean());

// <xs:simpleType name="inflection">
//     <xs:annotation>
//         <xs:appinfo>
//             <jaxb:typesafeEnumClass name="XmlInflection" />
//         </xs:appinfo>
//     </xs:annotation>
//     <xs:restriction base="xs:string">
//         <xs:enumeration value="GRECO_LATIN_REGULAR" />
//         <xs:enumeration value="IRREGULAR" />
//         <xs:enumeration value="REGULAR" />
//         <xs:enumeration value="REGULAR_DOUBLE" />
//         <xs:enumeration value="UNCOUNT" />
//         <xs:enumeration value="INVARIANT" />
//     </xs:restriction>
// </xs:simpleType>
const inflectionSchema = z.enum(InflectionValues);

// <xs:simpleType name="interrogativeType">
//     <xs:annotation>
//         <xs:appinfo>
//             <jaxb:typesafeEnumClass name="XmlInterrogativeType" />
//         </xs:appinfo>
//     </xs:annotation>
//     <xs:restriction base="xs:string">
//         <xs:enumeration value="HOW" />
//         <xs:enumeration value="WHAT_OBJECT" />
//         <xs:enumeration value="WHAT_SUBJECT" />
//         <xs:enumeration value="WHERE" />
//         <xs:enumeration value="WHO_INDIRECT_OBJECT" />
//         <xs:enumeration value="WHO_OBJECT" />
//         <xs:enumeration value="WHO_SUBJECT" />
//         <xs:enumeration value="WHY" />
//         <xs:enumeration value="YES_NO" />
//     </xs:restriction>
// </xs:simpleType>
const interrogativeTypeSchema = z.enum(InterrogativeTypeValues);

// <xs:simpleType name="person">
//     <xs:annotation>
//         <xs:appinfo>
//             <jaxb:typesafeEnumClass name="XmlPerson" />
//         </xs:appinfo>
//     </xs:annotation>
//     <xs:restriction base="xs:string">
//         <xs:enumeration value="FIRST" />
//         <xs:enumeration value="SECOND" />
//         <xs:enumeration value="THIRD" />
//     </xs:restriction>
// </xs:simpleType>
const personSchema = z.enum(PersonValues);

// <xs:simpleType name="numberAgreement">
//     <xs:annotation>
//         <xs:appinfo>
//             <jaxb:typesafeEnumClass name="XmlNumberAgreement" />
//         </xs:appinfo>
//     </xs:annotation>
//     <xs:restriction base="xs:string">
//         <xs:enumeration value="BOTH" />
//         <xs:enumeration value="PLURAL" />
//         <xs:enumeration value="SINGULAR" />
//     </xs:restriction>
// </xs:simpleType>
const numberAgreementSchema = z.enum(NumberAgreementValues);

// <xs:simpleType name="lexicalCategory">
//     <xs:annotation>
//         <xs:appinfo>
//             <jaxb:typesafeEnumClass name="XmlLexicalCategory" />
//         </xs:appinfo>
//     </xs:annotation>
//     <xs:restriction base="xs:string">
//         <xs:enumeration value="ANY" />
//         <xs:enumeration value="SYMBOL" />
//         <xs:enumeration value="NOUN" />
//         <xs:enumeration value="ADJECTIVE" />
//         <xs:enumeration value="ADVERB" />
//         <xs:enumeration value="VERB" />
//         <xs:enumeration value="DETERMINER" />
//         <xs:enumeration value="PRONOUN" />
//         <xs:enumeration value="CONJUNCTION" />
//         <xs:enumeration value="PREPOSITION" />
//         <xs:enumeration value="COMPLEMENTISER" />
//         <xs:enumeration value="MODAL" />
//         <xs:enumeration value="AUXILIARY" />
//     </xs:restriction>
// </xs:simpleType>
export const lexicalCategorySchema = z.enum(LexicalCategoryValues);

// <xs:simpleType name="gender">
//     <xs:annotation>
//         <xs:appinfo>
//             <jaxb:typesafeEnumClass name="XmlGender" />
//         </xs:appinfo>
//     </xs:annotation>
//     <xs:restriction base="xs:string">
//         <xs:enumeration value="MASCULINE" />
//         <xs:enumeration value="FEMININE" />
//         <xs:enumeration value="NEUTER" />
//     </xs:restriction>
// </xs:simpleType>
export const genderSchema = z.enum(GenderValues);

// <xs:simpleType name="form">
//     <xs:annotation>
//         <xs:appinfo>
//             <jaxb:typesafeEnumClass name="XmlForm" />
//         </xs:appinfo>
//     </xs:annotation>
//     <xs:restriction base="xs:string">
//         <xs:enumeration value="BARE_INFINITIVE" />
//         <xs:enumeration value="GERUND" />
//         <xs:enumeration value="IMPERATIVE" />
//         <xs:enumeration value="INFINITIVE" />
//         <xs:enumeration value="NORMAL" />
//         <xs:enumeration value="PAST_PARTICIPLE" />
//         <xs:enumeration value="PRESENT_PARTICIPLE" />
//     </xs:restriction>
// </xs:simpleType>
const formSchema = z.enum(FormValues);

// <xs:simpleType name="documentCategory">
//     <xs:annotation>
//         <xs:appinfo>
//             <jaxb:typesafeEnumClass name="XmlDocumentCategory" />
//         </xs:appinfo>
//     </xs:annotation>
//     <xs:restriction base="xs:string">
//         <xs:enumeration value="DOCUMENT" />
//         <xs:enumeration value="SECTION" />
//         <xs:enumeration value="PARAGRAPH" />
//         <xs:enumeration value="SENTENCE" />
//         <xs:enumeration value="LIST" />
//         <xs:enumeration value="LIST_ITEM" />
//     </xs:restriction>
// </xs:simpleType>
const documentCategorySchema = z.enum(DocumentCategoryValues); // the source contains one more item, which I think is a mistake from the Java code and having multiple sources of truth

// <xs:simpleType name="discourseFunction">
//     <xs:annotation>
//         <xs:appinfo>
//             <jaxb:typesafeEnumClass name="XmlDiscourseFunction" />
//         </xs:appinfo>
//     </xs:annotation>
//     <xs:restriction base="xs:string">
//         <xs:enumeration value="AUXILIARY" />
//         <xs:enumeration value="COMPLEMENT" />
//         <xs:enumeration value="CONJUNCTION" />
//         <xs:enumeration value="CUE_PHRASE" />
//         <xs:enumeration value="FRONT_MODIFIER" />
//         <xs:enumeration value="HEAD" />
//         <xs:enumeration value="INDIRECT_OBJECT" />
//         <xs:enumeration value="OBJECT" />
//         <xs:enumeration value="PRE_MODIFIER" />
//         <xs:enumeration value="POST_MODIFIER" />
//         <xs:enumeration value="SPECIFIER" />
//         <xs:enumeration value="SUBJECT" />
//         <xs:enumeration value="VERB_PHRASE" />
//     </xs:restriction>
// </xs:simpleType>
const discourseFunctionSchema = z.enum(DiscourseFunctionValues);

// <xs:simpleType name="clauseStatus">
//     <xs:annotation>
//         <xs:appinfo>
//             <jaxb:typesafeEnumClass name="XmlClauseStatus" />
//         </xs:appinfo>
//     </xs:annotation>
//     <xs:restriction base="xs:string">
//         <xs:enumeration value="MATRIX" />
//         <xs:enumeration value="SUBORDINATE" />
//     </xs:restriction>
// </xs:simpleType>
const clauseStatusSchema = z.enum(ClauseStatusValues);

// <xs:simpleType name="tense">
//     <xs:annotation>
//         <xs:appinfo>
//             <jaxb:typesafeEnumClass name="XmlTense" />
//         </xs:appinfo>
//     </xs:annotation>
//     <xs:restriction base="xs:string">
//         <xs:enumeration value="FUTURE" />
//         <xs:enumeration value="PAST" />
//         <xs:enumeration value="PRESENT" />
//     </xs:restriction>
// </xs:simpleType>
const tenseSchema = z.enum(TenseValues);

// <xs:simpleType name="phraseCategory">
//     <xs:annotation>
//         <xs:appinfo>
//             <jaxb:typesafeEnumClass name="XmlPhraseCategory" />
//         </xs:appinfo>
//     </xs:annotation>
//     <xs:restriction base="xs:string">
//         <xs:enumeration value="CLAUSE" />
//         <xs:enumeration value="ADJECTIVE_PHRASE" />
//         <xs:enumeration value="ADVERB_PHRASE" />
//         <xs:enumeration value="NOUN_PHRASE" />
//         <xs:enumeration value="PREPOSITIONAL_PHRASE" />
//         <xs:enumeration value="VERB_PHRASE" />
//         <xs:enumeration value="CANNED_TEXT" />
//     </xs:restriction>
// </xs:simpleType>
const phraseCategorySchema = z.enum(PhraseCategoryValues);

// <xs:attributeGroup name="wordAtts">
//     <xs:attribute name="cat" type="nlg:lexicalCategory" />
//     <xs:attribute name="id" type="xs:string" />
//     <xs:attribute name="EXPLETIVE_SUBJECT" type="xs:boolean" />
//     <xs:attribute name="PROPER" type="xs:boolean" />
//     <xs:attribute name="var" type="nlg:inflection" />
//     <xs:attribute name="canned" type="xs:boolean"></xs:attribute>
// </xs:attributeGroup>
const wordAttsSchema = z.object({
  cat: lexicalCategorySchema.optional(),
  id: z.string().optional(),
  EXPLETIVE_SUBJECT: booleanFromString.optional(),
  PROPER: booleanFromString.optional(),
  var: inflectionSchema.optional(),
  canned: booleanFromString.optional(),
});

// <xs:complexType name="WordElement">
//     <xs:annotation>
//         <xs:appinfo>
//             <jaxb:class name="XmlWordElement" />
//         </xs:appinfo>
//     </xs:annotation>
//     <xs:complexContent>
//         <xs:extension base="nlg:NLGElement"> // TODO: Seems like we didnt properly extend the NLGElement, check all other instances as well
//             <xs:sequence>
//                 <xs:element name="base" type="xs:string" />
//             </xs:sequence>
//             <xs:attributeGroup ref="nlg:wordAtts" />
//         </xs:extension>
//     </xs:complexContent>
// </xs:complexType>

const wordElementProperties = z.object({
  ...withTypeAndAttributes("WordElement", wordAttsSchema),
});
export type WordElementOutput = z.output<typeof wordElementProperties> & {
  base: string;
};
type WordElementInput = z.input<typeof wordElementProperties> & {
  base: { "#text": string };
};

const WordElementSchema: z.ZodType<
  WordElementOutput,
  z.ZodTypeDef,
  WordElementInput
> = z
  .object({
    base: fromXMLText(z.string()),
  })
  .and(wordElementProperties);

const wordElementFixedProperties = z.object({
  ...withAttributes(wordAttsSchema),
});

export type WordElementFixedOutput = z.output<
  typeof wordElementFixedProperties
> & {
  base: string;
};
type WordElementFixedInput = z.input<typeof wordElementFixedProperties> & {
  base: { "#text": string };
};

const WordElementFixedSchema: z.ZodType<
  WordElementFixedOutput,
  z.ZodTypeDef,
  WordElementFixedInput
> = z
  .object({
    base: fromXMLText(z.string()), // TODO: merge with other wordelement
  })
  .and(wordElementFixedProperties);

// <xs:complexType name="StringElement">
//     <xs:annotation>
//         <xs:appinfo>
//             <jaxb:class name="XmlStringElement" />
//         </xs:appinfo>
//     </xs:annotation>
//     <xs:complexContent>
//         <xs:extension base="nlg:NLGElement">
//             <xs:sequence>
//                 <xs:element name="val" type="xs:string" />
//             </xs:sequence>
//         </xs:extension>
//     </xs:complexContent>
// </xs:complexType>
const stringElementProperties = z.object({
  ...withTypeAndAttributes("StringElement", z.object({})),
});

export type StringElementOutput = z.output<typeof stringElementProperties> & {
  val: string;
};
type StringElementInput = z.input<typeof stringElementProperties> & {
  val: { "#text": string };
};

const StringElementSchema: z.ZodType<
  StringElementOutput,
  z.ZodTypeDef,
  StringElementInput
> = z
  .object({
    val: fromXMLText(z.string()),
    ...withTypeAndAttributes("StringElement", z.object({})),
  })
  .and(stringElementProperties);

// <xs:complexType name="PhraseElement" abstract="true">
// <xs:annotation>
//     <xs:appinfo>
//         <jaxb:class name="XmlPhraseElement" />
//     </xs:appinfo>
// </xs:annotation>
// <xs:complexContent>
//     <xs:extension base="nlg:NLGElement">
//         <xs:sequence>
//             <xs:element name="frontMod" type="nlg:NLGElement"
//                 minOccurs="0" maxOccurs="unbounded" />
//             <xs:element name="preMod" type="nlg:NLGElement"
//                 minOccurs="0" maxOccurs="unbounded" />
//             <xs:element name="compl" type="nlg:NLGElement"
//                 minOccurs="0" maxOccurs="unbounded" />
//             <xs:element name="postMod" type="nlg:NLGElement"
//                 minOccurs="0" maxOccurs="unbounded" />
//             <xs:element name="head" type="nlg:WordElement" minOccurs="0"/>
//         </xs:sequence>
//         <xs:attribute name="cat" type="nlg:phraseCategory" />
//         <xs:attribute name="discourseFunction" type="nlg:discourseFunction">
//         </xs:attribute>
//         <xs:attribute name="appositive" type="xs:boolean"></xs:attribute>
//     </xs:extension>
// </xs:complexContent>
// </xs:complexType>

// In order to support deeply recursive types we need to split the lazy (recursive) part of the base part of the schema
// We need to be super careful since we are manually defining the type in multiple locations

const phraseElementBaseProperties = z.object({
  ...withAttributes(
    z.object({
      cat: phraseCategorySchema.optional(),
      discourseFunction: discourseFunctionSchema.optional(),
      appositive: booleanFromString.optional(),
    }),
  ),
});

export type PhraseElementBaseOutput = z.output<
  typeof phraseElementBaseProperties
> & {
  frontMod?: NLGElementUnionOutput[] | undefined;
  preMod?: NLGElementUnionOutput[] | undefined;
  compl?: NLGElementUnionOutput[] | undefined;
  postMod?: NLGElementUnionOutput[] | undefined;
  head?: WordElementFixedOutput | undefined;
};
type PhraseElementBaseInput = z.input<typeof phraseElementBaseProperties> & {
  frontMod?: NLGElementUnionInput[] | undefined;
  preMod?: NLGElementUnionInput[] | undefined;
  compl?: NLGElementUnionInput[] | undefined;
  postMod?: NLGElementUnionInput[] | undefined;
  head?: WordElementFixedInput | undefined;
};

const PhraseElementBaseSchema: z.ZodType<
  PhraseElementBaseOutput,
  z.ZodTypeDef,
  PhraseElementBaseInput
> = z
  .object({
    frontMod: z.lazy(() => z.array(NLGElementSchema)).optional(),
    preMod: z.lazy(() => z.array(NLGElementSchema)).optional(),
    compl: z.lazy(() => z.array(NLGElementSchema)).optional(),
    postMod: z.lazy(() => z.array(NLGElementSchema)).optional(),
    head: WordElementFixedSchema.optional(), // TODO: WordElement is the only accepted type here, hence we need a version of the element where the type is not required
  })
  .and(phraseElementBaseProperties);

// <xs:attributeGroup name="CoordinatedPhraseAtts">
//     <xs:attribute name="conj" type="xs:string" default="and" />
//     <xs:attribute name="cat" type="nlg:phraseCategory" />
//     <xs:attribute name="APPOSITIVE" type="xs:boolean" />
//     <xs:attribute name="CONJUNCTION_TYPE" type="xs:string" />
//     <xs:attribute name="MODAL" type="xs:string" />
//     <xs:attribute name="NEGATED" type="xs:boolean" />
//     <xs:attribute name="NUMBER" type="nlg:numberAgreement" />
//     <xs:attribute name="PERSON" type="nlg:person" />
//     <xs:attribute name="POSSESSIVE" type="xs:boolean" />
//     <xs:attribute name="PROGRESSIVE" type="xs:boolean" />
//     <xs:attribute name="RAISE_SPECIFIER" type="xs:boolean" />
//     <xs:attribute name="SUPRESSED_COMPLEMENTISER" type="xs:boolean" />
//     <xs:attribute name="TENSE" type="nlg:tense" />
// </xs:attributeGroup>
const coordinatedPhraseAttsSchema = z.object({
  conj: z.string().optional().default("and"), // Conversion note: removed the default value, to remove English specific text and to avoid a zod bug
  cat: phraseCategorySchema.optional(),
  APPOSITIVE: booleanFromString.optional(),
  CONJUNCTION_TYPE: z.string().optional(),
  MODAL: z.string().optional(),
  NEGATED: booleanFromString.optional(),
  NUMBER: numberAgreementSchema.optional(),
  PERSON: personSchema.optional(),
  POSSESSIVE: booleanFromString.optional(),
  PROGRESSIVE: booleanFromString.optional(),
  RAISE_SPECIFIER: booleanFromString.optional(),
  SUPRESSED_COMPLEMENTISER: booleanFromString.optional(),
  TENSE: tenseSchema.optional(),
});

// <xs:complexType name="CoordinatedPhraseElement">
//     <xs:annotation>
//         <xs:appinfo>
//             <jaxb:class name="XmlCoordinatedPhraseElement" />
//         </xs:appinfo>
//     </xs:annotation>
//     <xs:complexContent>
//         <xs:extension base="nlg:NLGElement">
//             <xs:sequence>
//                 <xs:element name="coord" type="nlg:NLGElement"
//                     maxOccurs="unbounded" />
//             </xs:sequence>
//             <xs:attributeGroup ref="nlg:CoordinatedPhraseAtts" />
//         </xs:extension>
//     </xs:complexContent>
// </xs:complexType>

const coordinatedPhraseElementProperties = z.object({
  ...withTypeAndAttributes(
    "CoordinatedPhraseElement",
    coordinatedPhraseAttsSchema,
  ),
});

export type CoordinatedPhraseElementOutput = z.output<
  typeof coordinatedPhraseElementProperties
> & {
  coord: [NLGElementUnionOutput, ...NLGElementUnionOutput[]];
};

type CoordinatedPhraseElementInput = z.input<
  typeof coordinatedPhraseElementProperties
> & {
  coord: [NLGElementUnionInput, ...NLGElementUnionInput[]];
};

const CoordinatedPhraseElementSchema: z.ZodType<
  CoordinatedPhraseElementOutput,
  z.ZodTypeDef,
  CoordinatedPhraseElementInput
> = z
  .object({
    coord: z.lazy(() => z.array(NLGElementSchema).nonempty()),
  })
  .and(coordinatedPhraseElementProperties);

// <xs:complexType name="PPPhraseSpec">
//     <xs:annotation>
//         <xs:appinfo>
//             <jaxb:class name="XmlPPPhraseSpec" />
//         </xs:appinfo>
//     </xs:annotation>
//     <xs:complexContent>
//         <xs:extension base="nlg:PhraseElement">
//             <xs:sequence />
//         </xs:extension>
//     </xs:complexContent>
// </xs:complexType>

const ppPhraseSpecProperties = z.object({
  ...withTypeAndAttributes("PPPhraseSpec", z.object({})),
});

export type PPPhraseSpecOutput = z.output<typeof ppPhraseSpecProperties> &
  PhraseElementBaseOutput;
type PPPhraseSpecInput = z.input<typeof ppPhraseSpecProperties> &
  PhraseElementBaseInput;

const PPPhraseSpecSchema: z.ZodType<
  PPPhraseSpecOutput,
  z.ZodTypeDef,
  PPPhraseSpecInput
> = ppPhraseSpecProperties.and(PhraseElementBaseSchema);

// <xs:attributeGroup name="adjAdvPhraseAtts">
//     <xs:attribute name="IS_COMPARATIVE" type="xs:boolean" />
//     <xs:attribute name="IS_SUPERLATIVE" type="xs:boolean" />
// </xs:attributeGroup>
const adjAdvPhraseAttsSchema = z.object({
  IS_COMPARATIVE: booleanFromString.optional(),
  IS_SUPERLATIVE: booleanFromString.optional(),
});

// <xs:complexType name="AdvPhraseSpec">
// 		<xs:annotation>
// 			<xs:appinfo>
// 				<jaxb:class name="XmlAdvPhraseSpec" />
// 			</xs:appinfo>
// 		</xs:annotation>
// 		<xs:complexContent>
// 			<xs:extension base="nlg:PhraseElement">
// 				<xs:sequence />
// 				<xs:attributeGroup ref="nlg:adjAdvPhraseAtts" />
// 			</xs:extension>
// 		</xs:complexContent>
// 	</xs:complexType>

const advPhraseSpecProperties = z.object({
  ...withTypeAndAttributes("AdvPhraseSpec", adjAdvPhraseAttsSchema),
});

export type AdvPhraseSpecOutput = z.output<typeof advPhraseSpecProperties> &
  PhraseElementBaseOutput;
type AdvPhraseSpecInput = z.input<typeof advPhraseSpecProperties> &
  PhraseElementBaseInput;

const AdvPhraseSpecSchema: z.ZodType<
  AdvPhraseSpecOutput,
  z.ZodTypeDef,
  AdvPhraseSpecInput
> = advPhraseSpecProperties.and(PhraseElementBaseSchema);

// <xs:complexType name="AdjPhraseSpec">
// <xs:annotation>
//     <xs:appinfo>
//         <jaxb:class name="XmlAdjPhraseSpec" />
//     </xs:appinfo>
// </xs:annotation>
// <xs:complexContent>
//     <xs:extension base="nlg:PhraseElement">
//         <xs:sequence />
//         <xs:attributeGroup ref="nlg:adjAdvPhraseAtts" />
//     </xs:extension>
// </xs:complexContent>
// </xs:complexType>

const adjPhraseSpecProperties = z.object({
  ...withTypeAndAttributes("AdjPhraseSpec", adjAdvPhraseAttsSchema),
});

export type AdjPhraseSpecOutput = z.output<typeof adjPhraseSpecProperties> &
  PhraseElementBaseOutput;
type AdjPhraseSpecInput = z.input<typeof adjPhraseSpecProperties> &
  PhraseElementBaseInput;

const AdjPhraseSpecSchema: z.ZodType<
  AdjPhraseSpecOutput,
  z.ZodTypeDef,
  AdjPhraseSpecInput
> = adjPhraseSpecProperties.and(PhraseElementBaseSchema);

// <xs:attributeGroup name="npPhraseAtts">
//     <xs:attribute name="ADJECTIVE_ORDERING" type="xs:boolean" />
//     <xs:attribute name="ELIDED" type="xs:boolean" />
//     <xs:attribute name="NUMBER" type="nlg:numberAgreement" />
//     <xs:attribute name="GENDER" type="nlg:gender"></xs:attribute>
//     <xs:attribute name="PERSON" type="nlg:person" />
//     <xs:attribute name="POSSESSIVE" type="xs:boolean" />
//     <xs:attribute name="PRONOMINAL" type="xs:boolean" />
// </xs:attributeGroup>
const npPhraseAttsSchema = z.object({
  ADJECTIVE_ORDERING: booleanFromString.optional(),
  ELIDED: booleanFromString.optional(),
  NUMBER: numberAgreementSchema.optional(),
  GENDER: genderSchema.optional(),
  PERSON: personSchema.optional(),
  POSSESSIVE: booleanFromString.optional(),
  PRONOMINAL: booleanFromString.optional(),
});

// <xs:complexType name="NPPhraseSpec">
// <xs:annotation>
//     <xs:appinfo>
//         <jaxb:class name="XmlNPPhraseSpec" />
//     </xs:appinfo>
// </xs:annotation>
// <xs:complexContent>
//     <xs:extension base="nlg:PhraseElement">
//         <xs:sequence>
//             <xs:element name="spec" type="nlg:NLGElement" minOccurs="0" />
//         </xs:sequence>
//         <xs:attributeGroup ref="nlg:npPhraseAtts" />
//     </xs:extension>
// </xs:complexContent>
// </xs:complexType>
const npPhraseSpecProperties = z.object({
  ...withTypeAndAttributes("NPPhraseSpec", npPhraseAttsSchema),
});

export type NPPhraseSpecOutput = z.output<typeof npPhraseSpecProperties> &
  PhraseElementBaseOutput & {
    spec?: NLGElementUnionOutput | undefined;
  };
type NPPhraseSpecInput = z.input<typeof npPhraseSpecProperties> &
  PhraseElementBaseInput & {
    spec?: NLGElementUnionInput | undefined;
  };

const NPPhraseSpecSchema: z.ZodType<
  NPPhraseSpecOutput,
  z.ZodTypeDef,
  NPPhraseSpecInput
> = z
  .object({
    spec: z.lazy(() => NLGElementSchema).optional(),
  })
  .and(npPhraseSpecProperties)
  .and(PhraseElementBaseSchema);

// <xs:attributeGroup name="vpPhraseAtts">
// <xs:attribute name="AGGREGATE_AUXILIARY" type="xs:boolean" />
//     <xs:attribute name="FORM" type="nlg:form" />
//     <xs:attribute name="MODAL" type="xs:string" />
//     <xs:attribute name="NEGATED" type="xs:boolean" />
//     <xs:attribute name="PASSIVE" type="xs:boolean" />
//     <xs:attribute name="PERFECT" type="xs:boolean" />
//     <xs:attribute name="PERSON" type="nlg:person" />
//     <xs:attribute name="PROGRESSIVE" type="xs:boolean" />
//     <xs:attribute name="SUPPRESS_GENITIVE_IN_GERUND" type="xs:boolean" />
//     <xs:attribute name="SUPRESSED_COMPLEMENTISER" type="xs:boolean" />
//     <xs:attribute name="TENSE" type="nlg:tense" />
// </xs:attributeGroup>

const vpPhraseAttsSchema = z.object({
  AGGREGATE_AUXILIARY: booleanFromString.optional(),
  FORM: formSchema.optional(),
  MODAL: z.string().optional(),
  NEGATED: booleanFromString.optional(),
  PASSIVE: booleanFromString.optional(),
  PERFECT: booleanFromString.optional(),
  PERSON: personSchema.optional(),
  PROGRESSIVE: booleanFromString.optional(),
  SUPPRESS_GENITIVE_IN_GERUND: booleanFromString.optional(),
  SUPRESSED_COMPLEMENTISER: booleanFromString.optional(),
  TENSE: tenseSchema.optional(),
});

// <xs:complexType name="VPPhraseSpec">
// <xs:annotation>
//     <xs:appinfo>
//         <jaxb:class name="XmlVPPhraseSpec" />
//     </xs:appinfo>
// </xs:annotation>
// <xs:complexContent>
//     <xs:extension base="nlg:PhraseElement">
//         <xs:sequence />
//         <xs:attributeGroup ref="nlg:vpPhraseAtts" />
//     </xs:extension>
// </xs:complexContent>
// </xs:complexType>
const vpPhraseSpecProperties = z.object({
  ...withTypeAndAttributes("VPPhraseSpec", vpPhraseAttsSchema),
});

export type VPPhraseSpecOutput = z.output<typeof vpPhraseSpecProperties> &
  PhraseElementBaseOutput;

type VPPhraseSpecInput = z.input<typeof vpPhraseSpecProperties> &
  PhraseElementBaseInput;

const VPPhraseSpecSchema: z.ZodType<
  VPPhraseSpecOutput,
  z.ZodTypeDef,
  VPPhraseSpecInput
> = vpPhraseSpecProperties.and(PhraseElementBaseSchema);

// <xs:attributeGroup name="sPhraseAtts">
// <xs:attribute name="AGGREGATE_AUXILIARY" type="xs:boolean" />
//     <xs:attribute name="CLAUSE_STATUS" type="nlg:clauseStatus" />
//     <xs:attribute name="COMPLEMENTISER" type="xs:string" />
//     <xs:attribute name="FORM" type="nlg:form" />
//     <xs:attribute name="INTERROGATIVE_TYPE" type="nlg:interrogativeType" />
//     <xs:attribute name="MODAL" type="xs:string" />
//     <xs:attribute name="NEGATED" type="xs:boolean" />
//     <xs:attribute name="PASSIVE" type="xs:boolean" />
//     <xs:attribute name="PERFECT" type="xs:boolean" />
//     <xs:attribute name="PERSON" type="nlg:person" />
//     <xs:attribute name="PROGRESSIVE" type="xs:boolean" />
// <xs:attribute name="SUPPRESS_GENITIVE_IN_GERUND" type="xs:boolean" />
// <xs:attribute name="SUPRESSED_COMPLEMENTISER" type="xs:boolean" />
//     <xs:attribute name="TENSE" type="nlg:tense" />
// </xs:attributeGroup>
const sPhraseAttsSchema = z.object({
  AGGREGATE_AUXILIARY: booleanFromString.optional(),
  CLAUSE_STATUS: clauseStatusSchema.optional(),
  COMPLEMENTISER: z.string().optional(),
  FORM: formSchema.optional(),
  INTERROGATIVE_TYPE: interrogativeTypeSchema.optional(),
  MODAL: z.string().optional(),
  NEGATED: booleanFromString.optional(),
  PASSIVE: booleanFromString.optional(),
  PERFECT: booleanFromString.optional(),
  PERSON: personSchema.optional(),
  PROGRESSIVE: booleanFromString.optional(),
  SUPPRESS_GENITIVE_IN_GERUND: booleanFromString.optional(),
  SUPRESSED_COMPLEMENTISER: booleanFromString.optional(),
  TENSE: tenseSchema.optional(),
});

// <xs:complexType name="SPhraseSpec">
// <xs:annotation>
//     <xs:appinfo>
//         <jaxb:class name="XmlSPhraseSpec" />
//     </xs:appinfo>
// </xs:annotation>
// <xs:complexContent>
//     <xs:extension base="nlg:PhraseElement">
//         <xs:sequence>
//             <xs:element name="cuePhrase" type="nlg:NLGElement"
//                 minOccurs="0" />
//             <xs:element name="subj" type="nlg:NLGElement" minOccurs="0"
//                 maxOccurs="unbounded" />
//             <xs:element name="vp" type="nlg:NLGElement" />
//         </xs:sequence>
//         <xs:attributeGroup ref="nlg:sPhraseAtts" />
//     </xs:extension>
// </xs:complexContent>
// </xs:complexType>

const sPhraseSpecProperties = z.object({
  ...withTypeAndAttributes("SPhraseSpec", sPhraseAttsSchema),
});

export type SPhraseSpecOutput = z.output<typeof sPhraseSpecProperties> &
  PhraseElementBaseOutput & {
    cuePhrase?: NLGElementUnionOutput | undefined;
    subj?: NLGElementUnionOutput[] | undefined;
    vp: NLGElementUnionOutput;
  };
type SPhraseSpecInput = z.input<typeof sPhraseSpecProperties> &
  PhraseElementBaseInput & {
    cuePhrase?: NLGElementUnionInput | undefined;
    subj?: NLGElementUnionInput[] | undefined;
    vp: NLGElementUnionInput;
  };

const SPhraseSpecSchema: z.ZodType<
  SPhraseSpecOutput,
  z.ZodTypeDef,
  SPhraseSpecInput
> = z
  .object({
    cuePhrase: z.lazy(() => NLGElementSchema).optional(),
    subj: z.lazy(() => z.array(NLGElementSchema)).optional(),
    vp: z.lazy(() => NLGElementSchema),
  })
  .and(PhraseElementBaseSchema)
  .and(sPhraseSpecProperties);

// <xs:attributeGroup name="docAtts">
// <xs:attribute name="cat" type="nlg:documentCategory" />
// <xs:attribute name="title" type="xs:string" />
// </xs:attributeGroup>
const docAttsSchema = z.object({
  cat: documentCategorySchema.optional(),
  title: z.string().optional(),
});

// <xs:complexType name="DocumentElement">
// <xs:annotation>
//     <xs:appinfo>
//         <jaxb:class name="XmlDocumentElement" />
//     </xs:appinfo>
// </xs:annotation>
// <xs:complexContent>
//     <xs:extension base="nlg:NLGElement">
//         <xs:sequence>
//             <xs:element name="child" type="nlg:NLGElement"
//                 minOccurs="0" maxOccurs="unbounded" />
//         </xs:sequence>
//         <xs:attributeGroup ref="nlg:docAtts" />
//     </xs:extension>
// </xs:complexContent>
// </xs:complexType>

const documentElementProperties = z.object({
  ...withTypeAndAttributes("DocumentElement", docAttsSchema),
});

export type DocumentElementOutput = z.output<
  typeof documentElementProperties
> & {
  child?: NLGElementUnionOutput[] | undefined;
};
type DocumentElementInput = z.input<typeof documentElementProperties> & {
  child?: NLGElementUnionInput[] | undefined;
};
const DocumentElementSchema: z.ZodType<
  DocumentElementOutput,
  z.ZodTypeDef,
  DocumentElementInput
> = documentElementProperties.and(
  z.object({
    child: z.lazy(() => z.array(NLGElementSchema)).optional(),
  }),
);

const documentElementFixedProperties = z.object({
  ...withAttributes(docAttsSchema),
});

export type DocumentElementFixedOutput = z.output<
  typeof documentElementFixedProperties
> & {
  child?: NLGElementUnionOutput[] | undefined;
};
type DocumentElementFixedInput = z.input<
  typeof documentElementFixedProperties
> & {
  child?: NLGElementUnionInput[] | undefined;
};
const DocumentElementFixedSchema: z.ZodType<
  DocumentElementFixedOutput,
  z.ZodTypeDef,
  DocumentElementFixedInput
> = documentElementFixedProperties.and(
  z.object({
    child: z.lazy(() => z.array(NLGElementSchema)).optional(), // TODO: merge with regular DocumentElement
  }),
);

// <xs:complexType name="DocumentRealisation">
// <xs:sequence>
//     <xs:element name="Document" type="nlg:DocumentElement"
//         maxOccurs="1" minOccurs="1" />
//     <xs:element name="Realisation" type="xs:string" minOccurs="0"
//         maxOccurs="1" />
// </xs:sequence>
// <xs:attribute name="name" type="xs:string" />
// </xs:complexType>

const documentRealisationProperties = z.object({
  ...withAttributes(
    z.object({
      name: z.string().optional(),
    }),
  ),
});

export type DocumentRealisationOutput = z.output<
  typeof documentRealisationProperties
> & {
  Document: DocumentElementFixedOutput;
  Realisation?: string | undefined;
};
type DocumentRealisationInput = z.input<
  typeof documentRealisationProperties
> & {
  Document: DocumentElementFixedInput;
  Realisation?: { "#text": string } | undefined;
};

const DocumentRealisationSchema: z.ZodType<
  DocumentRealisationOutput,
  z.ZodTypeDef,
  DocumentRealisationInput
> = z
  .object({
    Document: DocumentElementFixedSchema,
    Realisation: z.lazy(() => fromXMLText(z.string())).optional(),
  })
  .and(documentRealisationProperties);

// <xs:complexType name="RecordSet">
// <xs:sequence>
//     <xs:element name="Record" type="nlg:DocumentRealisation"
//         maxOccurs="unbounded" minOccurs="1" />
// </xs:sequence>
// <xs:attribute name="name" type="xs:string" />
// </xs:complexType>
const RecordSetSchema = z.object({
  Record: z.array(DocumentRealisationSchema).nonempty(),
  ...withAttributes(z.object({ name: z.string().optional() })),
});

// <xs:complexType name="RequestType">
//   <xs:sequence>
//       <xs:element name="Document" type="nlg:DocumentElement"></xs:element>
//   </xs:sequence>
// </xs:complexType>
const RequestTypeSchema = z.object({
  Document: DocumentElementFixedSchema,
});

// <xs:element name="NLGSpec">
//   <xs:complexType>
//       <xs:choice>
//           <xs:element name="Request" type="nlg:RequestType" />
//           <xs:element name="Recording" type="nlg:RecordSet" />
//       </xs:choice>
//   </xs:complexType>
// </xs:element>
export const NLGSpec = z.object({
  NLGSpec: z.union([
    z.object({ Request: RequestTypeSchema }),
    z.object({ Recording: RecordSetSchema }),
  ]),
});
export type NLGSpecType = z.infer<typeof NLGSpec>;

const PhraseElementSchema: z.ZodType<
  PhraseElementUnionOutput,
  z.ZodTypeDef,
  PhraseElementUnionInput
> = z.union([
  // cannot use discriminated union here, due to transform usage
  AdjPhraseSpecSchema,
  PPPhraseSpecSchema,
  AdvPhraseSpecSchema,
  NPPhraseSpecSchema,
  VPPhraseSpecSchema,
  SPhraseSpecSchema,
]);

export type PhraseElementUnionOutput =
  | AdjPhraseSpecOutput
  | PPPhraseSpecOutput
  | AdvPhraseSpecOutput
  | NPPhraseSpecOutput
  | VPPhraseSpecOutput
  | SPhraseSpecOutput;

type PhraseElementUnionInput =
  | AdjPhraseSpecInput
  | PPPhraseSpecInput
  | AdvPhraseSpecInput
  | NPPhraseSpecInput
  | VPPhraseSpecInput
  | SPhraseSpecInput;

type NLGElementUnionInput =
  | CoordinatedPhraseElementInput
  | WordElementInput
  | StringElementInput
  | PhraseElementUnionInput
  | DocumentElementInput;

export type NLGElementUnionOutput =
  | CoordinatedPhraseElementOutput
  | WordElementOutput
  | StringElementOutput
  | PhraseElementUnionOutput
  | DocumentElementOutput;

// <xs:complexType name="NLGElement" abstract="true">
//     <xs:annotation>
//         <xs:appinfo>
//             <jaxb:class name="XmlNLGElement" />
//         </xs:appinfo>
//     </xs:annotation>
//     <xs:sequence />
// </xs:complexType>
const NLGElementSchema: z.ZodType<
  NLGElementUnionOutput,
  z.ZodTypeDef,
  NLGElementUnionInput
> = z.union([
  // cannot use discriminated union here, due to transform usage
  CoordinatedPhraseElementSchema,
  WordElementSchema,
  StringElementSchema,
  PhraseElementSchema,
  DocumentElementSchema,
]);
