import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hermes-Clawdbot Control Center",
  description: "Autonomous Multi-Platform Agent Engine with MicroVM Sandboxing & Durable Workflows",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#090d16] text-slate-100 antialiased selection:bg-sky-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
