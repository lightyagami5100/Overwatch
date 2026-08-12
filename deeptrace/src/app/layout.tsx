import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
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
      className={`h-full antialiased ${inter.variable} ${jetbrainsMono.variable}`}
    >
      <body className="min-h-full flex flex-col bg-[#000000] text-[#f5f5f7]">
        {children}
      </body>
    </html>
  );
}
