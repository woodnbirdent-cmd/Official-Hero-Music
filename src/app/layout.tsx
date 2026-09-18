import type { Metadata, Viewport } from "next";
import { Inter, Bebas_Neue } from "next/font/google";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ListenBar from "@/components/ListenBar";
import { SITE } from "@/lib/constants";
import "./globals.css";

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const display = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "Official #Hero Music",
    template: "%s | Official #Hero Music",
  },
  description: SITE.description,
  applicationName: SITE.name,
  authors: [{ name: SITE.artist }],
  keywords: [
    "#Hero",
    "Hero Music",
    "Christian hip-hop",
    "CHH",
    "Yahfamilia",
    "Jefferson City",
    "Christopher James Killion",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE.url,
    siteName: SITE.name,
    title: "Official #Hero Music",
    description: SITE.description,
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "#Hero" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Official #Hero Music",
    description: SITE.description,
    images: ["/og.png"],
  },
  icons: {
    icon: [{ url: "/favicon.png", type: "image/png" }],
    apple: [{ url: "/icon-192.png" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable}`}>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
        <ListenBar />
      </body>
    </html>
  );
}
