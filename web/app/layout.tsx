import type { Metadata } from "next";
import { Newsreader, Hanken_Grotesk } from "next/font/google";
import { Header } from "@/components/Header";
import { CONTRACT, EXPLORER } from "@/lib/chain";
import "./globals.css";

const serif = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});
const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: "Recourse Market",
  description:
    "Handmade goods from independent makers. Every order comes with a receipt that holds part of your payment until the order is right.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body>
        <Header />
        <main>{children}</main>
        <footer className="footer">
          <p>
            Recourse Market is a working demo on NEAR testnet, built for NEAR HACKATHON. Prices are in test USDC
            and every purchase is a real testnet transaction.
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
