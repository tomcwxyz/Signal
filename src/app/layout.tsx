import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "leaflet/dist/leaflet.css";
import "./globals.css";
const interfaceFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
export const viewport: Viewport = { themeColor: "#123b4b", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-GB" className={`${interfaceFont.variable} ${dataFont.variable}`}><body>{children}</body></html>;
}
