import { FIGURE_GROUP_SEPARATOR, formatSats, formatWithFigureGrouping } from "../wallet/format-number";
import { convertSatsToFiat } from "../wallet/format-fiat";

const g = FIGURE_GROUP_SEPARATOR;

describe("figure formatting", () => {
  it("groups sats with a narrow no-break space", () => {
    expect(formatSats(0)).toBe("0");
    expect(formatSats(999)).toBe("999");
    expect(formatSats(1240)).toBe(`1${g}240`);
    expect(formatSats(100_000_000)).toBe(`100${g}000${g}000`);
    expect(formatSats(-50_000)).toBe(`-50${g}000`);
  });

  it("drops fractions from sat amounts", () => {
    expect(formatSats(1234.6)).toBe(`1${g}235`);
  });

  it("keeps the locale's decimal mark and currency layout", () => {
    const es = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
    expect(formatWithFigureGrouping(es, 12345.5)).toBe(`12${g}345,50 €`);
  });

  it("groups fiat amounts the same way", () => {
    expect(convertSatsToFiat({ sats: 100_000_000, ratePerBtc: 65_432.1, currency: "USD" })).toMatch(
      new RegExp(`65${g}432[.,]10`),
    );
  });
});
