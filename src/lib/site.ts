/** Canonical public origin, used for absolute URLs in metadata, sitemap and share cards. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://signal.good-ship.co.uk").replace(/\/+$/, "");
export const SITE_NAME = "Signal";
export const SITE_TITLE = "Signal: find public Wi-Fi and mobile coverage in the UK";
export const SITE_DESCRIPTION =
  "Find public Wi-Fi near you and check 4G/5G mobile coverage by postcode across the UK. Save Wi-Fi details to use offline. Free, no account needed.";
