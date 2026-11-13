/** Example photos for links made without one, matched on the item name. */
const STOCK: [RegExp, string][] = [
  [/tote|bag|purse/i, "market-tote"],
  [/wallet|card ?holder/i, "card-wallet"],
  [/belt/i, "natural-belt"],
  [/mug|cup/i, "enamel-mug"],
  [/jacket|coat/i, "field-jacket"],
  [/cushion|pillow|aso-?oke/i, "aso-oke-cushion"],
  [/runner|table ?cloth/i, "table-runner"],
  [/throw|blanket|indigo/i, "indigo-throw"],
  [/leather/i, "market-tote"],
];

export function stockPhoto(title: string): string | null {
  const hit = STOCK.find(([re]) => re.test(title));
  return hit ? `/products/${hit[1]}.jpg` : null;
}
