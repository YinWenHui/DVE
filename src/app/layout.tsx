import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Digital Verse", template: "%s · Digital Verse" },
  description: "Self-hosted manufacturing business intelligence and reporting platform.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <body><ThemeProvider>{children}</ThemeProvider></body>
    </html>
  );
}
