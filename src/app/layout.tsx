import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Fraunces, Hanken_Grotesk, IBM_Plex_Mono } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
const displayFont = Fraunces({
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
  variable: "--font-signal-display",
  display: "swap",
});

const interfaceFont = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-signal-interface",
  display: "swap",
});

const dataFont = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-signal-data",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Signal — find a connection",
  description: "Explore UK public Wi-Fi and save useful connection details for when you're offline.",
  applicationName: "Signal",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" }
};
export const viewport: Viewport = { themeColor: "#f3efe6", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-GB" className={`${displayFont.variable} ${interfaceFont.variable} ${dataFont.variable}`}><body><Script src="https://good-ship.co.uk/analytics/browser.js" strategy="afterInteractive" />{children}</body></html>;
}
