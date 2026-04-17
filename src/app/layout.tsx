import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/components/AuthProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AgentPrint — Detect the Fingerprint AI Agents Leave on Code",
  description: "Detect the fingerprint AI coding agents leave on open-source projects velocity",
  metadataBase: new URL("https://agentprint.falkordb.com"),
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "AgentPrint — Detect the Fingerprint AI Agents Leave on Code",
    description: "Detect the fingerprint AI coding agents leave on open-source projects velocity",
    siteName: "AgentPrint",
    type: "website",
    url: "https://agentprint.falkordb.com",
    images: [{ url: "/api/og", width: 1200, height: 630, type: "image/png" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "AgentPrint — Detect the Fingerprint AI Agents Leave on Code",
    description: "Detect the fingerprint AI coding agents leave on open-source projects velocity",
    images: [{ url: "/api/og", width: 1200, height: 630 }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-gray-50 dark:bg-gray-900">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
