// The demo runs on NEAR testnet with a handful of prepared accounts, so judges
// can try every role without setting up a wallet. The interface says so.

import { cookies } from "next/headers";
import { MASTER } from "./chain";

export type Person = { key: string; name: string; role: "buyer" | "seller" | "reviewer" };

export const PEOPLE: Person[] = [
  { key: "buyer-a", name: "Ada", role: "buyer" },
  { key: "buyer-b", name: "Bayo", role: "buyer" },
  { key: "atelier", name: "Atelier Ama", role: "seller" },
  { key: "loomhouse", name: "Loom House", role: "seller" },
  { key: "fieldkit", name: "Field Kit Supply", role: "seller" },
  { key: "reviewer", name: "Reviewer", role: "reviewer" },
];

// The reviewer is the contract owner (the master account itself).
export const accountOf = (key: string) => (key === "reviewer" ? MASTER : `${key}.${MASTER}`);

export function personByKey(key: string | undefined): Person {
  return PEOPLE.find((p) => p.key === key) || PEOPLE[0];
}

export function personByAccount(account: string): Person | undefined {
  return PEOPLE.find((p) => accountOf(p.key) === account);
}

export async function currentPerson(): Promise<Person> {
  const jar = await cookies();
  return personByKey(jar.get("as")?.value);
}
