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
  title: "Kevin Yeoh — Full-Stack, 3D Web & Game Developer",
  description:
    "Production 3D web products and shipped games by Kevin Yeoh, a full-stack and game developer in Kuala Lumpur, Malaysia.",
  openGraph: {
    title: "Kevin Yeoh — I build digital worlds that people can use.",
    description:
      "Production 3D web products and shipped games by Kevin Yeoh.",
    type: "website",
    images: [
      {
        url: "/og.png",
        width: 1730,
        height: 909,
        alt: "Kevin Yeoh — Full-stack, 3D web, and games",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Kevin Yeoh — Full-Stack, 3D Web & Game Developer",
    description: "Production 3D web products and shipped games.",
    images: ["/og.png"],
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
