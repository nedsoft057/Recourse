import Link from "next/link";
import { currentPerson, PEOPLE } from "@/lib/identity";
import { IdentitySwitcher } from "./IdentitySwitcher";

export async function Header() {
  const me = await currentPerson();
  return (
    <header className="masthead">
      <div className="masthead-inner">
        <Link href="/" className="wordmark">Recourse</Link>
        <nav className="nav" aria-label="Main">
          <Link href="/new">Create a link</Link>
          <Link href="/sell">Seller desk</Link>
          <Link href="/purchases">Purchases</Link>
        </nav>
        <IdentitySwitcher people={PEOPLE} current={me.key} />
      </div>
    </header>
  );
}
