import type { Metadata } from "next";
import { JetBrains_Mono, Caesar_Dressing, Montserrat, Karla } from "next/font/google";
import "./globals.css";

const karla = Karla({
  subsets: ["latin"],
  variable: "--font-sans",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["800"], // The user specifically requested weight 800 in the link
  variable: "--font-heading",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const caesarDressing = Caesar_Dressing({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-caesar",
});

export const metadata: Metadata = {
  title: "OVERWATCH — Tactical Incident Command",
  description:
    "AI-powered cybersecurity command center for threat intelligence processing, entity extraction, relationship mapping, and tamper-proof evidence management.",
  keywords: [
    "cybersecurity",
    "threat intelligence",
    "incident response",
    "NLP",
    "graph visualization",
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${karla.variable} ${montserrat.variable} ${jetbrainsMono.variable} ${caesarDressing.variable}`}
    >
      <body className="min-h-full flex flex-col bg-[#000000] text-[#f5f5f7]">
        {children}
      </body>
    </html>
  );
}
