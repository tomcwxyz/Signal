import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Signal — find a connection",
  description: "Explore UK public Wi-Fi and save useful connection details for when you're offline.",
  applicationName: "Signal",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" }
};
export const viewport: Viewport = { themeColor: "#123b4b", width: "device-width", initialScale: 1 };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en-GB"><body>{children}</body></html>;
}
