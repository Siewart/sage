import { z } from "zod";

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
