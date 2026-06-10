import { NLGElement } from "../framework/NLGElement.js";
import { StringElement } from "../framework/StringElement.js";
import { Lexicon } from "../lexicon/Lexicon.js";
import { XMLLexicon } from "../lexicon/XMLLexicon.js";
import { Realiser } from "../realiser/english/Realiser.js";
import { EnglishFactory } from "./english/EnglishFactory.js";
import { NLGFactory } from "./NLGFactory.js";

// Conversion note: We may want to make this generic to support arbitrary features for other languages
export type NLGContext = {
  readonly factory: NLGFactory;
  readonly lexicon: Lexicon;
  readonly _realiser: Realiser;
  readonly getEmpty: (reason?: string) => NLGElement;
};
type Writeable<T> = { -readonly [P in keyof T]: T[P] };
type _Context = Writeable<Partial<NLGContext>>;

export const defaultEnglishContext: NLGContext = (() => {
  const context: _Context = {};
  context.lexicon = XMLLexicon.createDefaultLexicon(context as NLGContext);
  context.factory = EnglishFactory.withContext(context as NLGContext);
  context._realiser = Realiser.create(context as NLGContext);
  context.getEmpty = (reason?: string) => {
    const stre = StringElement.fromString("", context as NLGContext);
    if (reason) stre.features["EmptyReason"] = reason;
    return stre;
  };
  return context as NLGContext;
})();
