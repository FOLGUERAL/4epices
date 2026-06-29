import type { Metadata } from "next";
import Link from "next/link";
import Navigation from "@/components/Navigation";
import AdSenseScript from "@/components/AdSenseScript";
import ShoppingList from "@/components/ShoppingList";
import ToastContainer from "@/components/Toast";
import {
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  getSiteUrl,
  isAdSenseEnabled,
  SITE_NAME,
} from "@/lib/seo";
import "./globals.css";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: SITE_NAME,
  title: {
    default: `${SITE_NAME} | Recettes faciles, rapides et gourmandes`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "Découvrez des recettes faciles, rapides et gourmandes : plats du quotidien, cuisine du monde, desserts et idées repas.",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: "/logo_carre_favicon.png",
    shortcut: "/logo_carre_favicon.png",
    apple: "/logo_carre_favicon.png",
  },
  openGraph: {
    title: `${SITE_NAME} | Recettes faciles, rapides et gourmandes`,
    description:
      "Recettes faciles, rapides et gourmandes pour tous les jours.",
    url: siteUrl,
    siteName: SITE_NAME,
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | Recettes faciles, rapides et gourmandes`,
    description:
      "Recettes faciles, rapides et gourmandes pour tous les jours.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adsEnabled = isAdSenseEnabled();
  const organizationJsonLd = buildOrganizationJsonLd();
  const webSiteJsonLd = buildWebSiteJsonLd();

  return (
    <html lang="fr">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {adsEnabled && <AdSenseScript />}
        <Navigation />
        {children}
        <ShoppingList />
        <ToastContainer />
        <footer className="bg-gray-800 text-white mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400 text-sm">
                © {new Date().getFullYear()} {SITE_NAME}. Tous droits réservés.
              </p>
              <nav className="mt-4 md:mt-0">
                <Link
                  href="/politique-de-confidentialite"
                  className="text-gray-400 hover:text-white text-sm transition-colors"
                >
                  Politique de confidentialité
                </Link>
              </nav>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
