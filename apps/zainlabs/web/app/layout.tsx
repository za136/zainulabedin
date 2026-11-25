import type { Metadata, Viewport } from "next";
import { site } from "@zainlabs/content";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { SITE_URL } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${site.name}: ${site.claim}`, template: `%s · ${site.name}` },
  description: site.intro,
  openGraph: { title: site.name, description: site.claim, type: "website", locale: "en_GB" },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = { themeColor: "#0e0e0f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: SITE_URL,
    email: site.email,
    areaServed: ["DE", "AT", "CH"],
    description: site.intro,
  };
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </body>
    </html>
  );
}
