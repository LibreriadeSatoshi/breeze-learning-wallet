// ISMOS figures group thousands with a thin space ("10 000"). The narrow
// no-break space keeps a figure from wrapping across lines.
export const FIGURE_GROUP_SEPARATOR = " ";

export function formatWithFigureGrouping(formatter: Intl.NumberFormat, value: number): string {
  return formatter
    .formatToParts(value)
    .map((part) => (part.type === "group" ? FIGURE_GROUP_SEPARATOR : part.value))
    .join("");
}

const integerFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatSats(value: number): string {
  return formatWithFigureGrouping(integerFormatter, value);
}
