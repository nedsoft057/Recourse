import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Header } from "@/components/Header";
import { DemoGuide } from "@/components/DemoGuide";
import { currentPerson } from "@/lib/identity";
import { CONTRACT, EXPLORER } from "@/lib/chain";
import "./globals.css";

const serif = Inter({ subsets: ["latin"], variable: "--font-serif", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Recourse: protected payment links",
  description:
    "Make a protected payment link for anything you sell. Buyers pay in USDC; part is held in their receipt until the order is right.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const me = await currentPerson();
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <Header />
        <main>{children}</main>
        <DemoGuide current={me.key} />
        <footer className="site-footer">
          <div className="footer-inner">
            <div>
              <p className="footer-brand"><img src="/logo.svg" alt="" width={24} height={24} className="logo-mark" /> Recourse</p>
              <p className="muted small">Buyer protection for stablecoin payments.</p>
            </div>
            <nav className="footer-links" aria-label="Footer">
              <a href="/new">Create a link</a>
              <a href="/sell">Seller desk</a>
              <a href="/purchases">Purchases</a>
              <a href={`${EXPLORER}/address/${CONTRACT}`} target="_blank" rel="noreferrer">Contract on NearBlocks</a>
              <a href="https://github.com/nedsoft057/recourse" target="_blank" rel="noreferrer">Source on GitHub</a>
            </nav>
          </div>
          <p className="footer-note">
            A working demo on NEAR testnet, built for NEAR HACKATHON. Payments use test USDC and every action is a real
            testnet transaction, signed for one of the demo people chosen at the top.
          </p>
          <div className="giant-word" aria-hidden="true">RECOURSE</div>
        </footer>
      </body>
    </html>
  );
}
