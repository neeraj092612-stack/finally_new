import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-600.css";

export const metadata: Metadata = {
  title: "FinAlly — AI Trading Workstation",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-bg font-sans text-body text-text antialiased">{children}</body>
    </html>
  );
}
