import { DeterminerAgrHelper } from "../../../src/morphology/english/DeterminerAgrHelper.js";

describe("Determiner Agreement Helper Tests", () => {
  test("Requires An", () => {
    expect(DeterminerAgrHelper.requiresAn("elephant")).toBe(true);
    expect(DeterminerAgrHelper.requiresAn("cow")).toBe(false);
    expect(DeterminerAgrHelper.requiresAn("hour")).toBe(false);
    expect(DeterminerAgrHelper.requiresAn("one")).toBe(false);
    expect(DeterminerAgrHelper.requiresAn("100")).toBe(false);
  });

  test("Check Ends With Indefinite Article 1", () => {
    const cannedText = "I see a";
    const np = "elephant";
    const expected = "I see an";
    const actual = DeterminerAgrHelper.checkEndsWithIndefiniteArticle(
      cannedText,
      np,
    );
    expect(actual).toBe(expected);
  });

  test("Check Ends With Indefinite Article 2", () => {
    const cannedText = "I see a";
    const np = "cow";
    const expected = "I see a";
    const actual = DeterminerAgrHelper.checkEndsWithIndefiniteArticle(
      cannedText,
      np,
    );
    expect(actual).toBe(expected);
  });

  test("Check Ends With Indefinite Article 3", () => {
    const cannedText = "I see an";
    const np = "cow";
    const expected = "I see an";
    const actual = DeterminerAgrHelper.checkEndsWithIndefiniteArticle(
      cannedText,
      np,
    );
    expect(actual).toBe(expected);
  });
});
