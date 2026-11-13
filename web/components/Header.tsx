import Link from "next/link";
import { currentPerson, PEOPLE } from "@/lib/identity";
import { IdentitySwitcher } from "./IdentitySwitcher";

export async function Header() {
  const me = await currentPerson();
  return (
    <header className="masthead">
      <Link href="/" className="wordmark">Recourse Market</Link>
      <nav className="nav" aria-label="Main">
        <Link href="/">Shop</Link>
        <Link href="/purchases">Purchases</Link>
        <Link href="/sell">Seller desk</Link>
      </nav>
      <IdentitySwitcher people={PEOPLE} current={me.key} />
    </header>
  );
}
