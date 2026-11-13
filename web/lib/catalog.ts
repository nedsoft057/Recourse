import data from "@/data/products.json";

export type Product = (typeof data.products)[number];
export type MakerKey = keyof typeof data.makers;

export const makers = data.makers;
export const products = data.products;

export function productForImage(image: string | null | undefined): Product | undefined {
  if (!image) return undefined;
  const slug = image.replace(/^\/products\//, "").replace(/\.jpg$/, "");
  return products.find((p) => p.slug === slug);
}

export function makerKeyFromAccount(account: string): MakerKey | undefined {
  const key = account.split(".")[0];
  return key in makers ? (key as MakerKey) : undefined;
}
