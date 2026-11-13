import type { Metadata } from "next";
import { Instrument_Serif, Inter_Tight } from "next/font/google";
import { Header } from "@/components/Header";
import { CONTRACT, EXPLORER } from "@/lib/chain";
import "./globals.css";

const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});
const sans = Inter_Tight({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Recourse: protected payment links",
  description:
    "Make a protected payment link for anything you sell. Buyers pay in USDC; part is held in their receipt until the order is right.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <Header />
        <main>{children}</main>
        <footer className="footer">
          <p>
            Recourse is a working demo on NEAR testnet, built for NEAR HACKATHON. Payments use test USDC and every
            action is a real testnet transaction, signed for one of the demo people chosen at the top.
          </p>
          <p>
            <a href={`${EXPLORER}/address/${CONTRACT}`} target="_blank" rel="noreferrer">
              View the contract on NearBlocks
            </a>
            {"  "}
            <a href="https://github.com/nedsoft057/recourse" target="_blank" rel="noreferrer">
              Source on GitHub
            </a>
          </p>
        </footer>
      </body>
    </html>
  );
}
