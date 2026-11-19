import SignalApp from "@/components/SignalApp";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: SITE_URL + "/",
  description: SITE_DESCRIPTION,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Any",
  browserRequirements: "Requires JavaScript",
  inLanguage: "en-GB",
  areaServed: { "@type": "Country", name: "United Kingdom" },
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "GBP" }
};

export default function HomePage() {
  return <>
    <script type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}/>
    <SignalApp />
  </>;
}
