import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
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
  metadataBase: new URL("https://eternalamarisuniverse.com"),
  title: "Kevin Yeoh — Full-Stack Archviz, Interactive 3D & Games",
  description:
    "Architectural visualisation products, interactive 3D systems and games by Kevin Yeoh in Kuala Lumpur, Malaysia.",
  openGraph: {
    title: "Building digital worlds — Kevin Yeoh",
    description:
      "Full-stack architectural visualisation, interactive 3D and games.",
    type: "website",
    images: [
      {
        url: "/og-v2.png",
        width: 1731,
        height: 909,
        alt: "Building digital worlds — Archviz, full-stack and games by EAU",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Building digital worlds — Kevin Yeoh",
    description: "Full-stack architectural visualisation, interactive 3D and games.",
    images: ["/og-v2.png"],
  },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
