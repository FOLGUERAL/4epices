import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import Navigation from "@/components/Navigation";
import ShoppingList from "@/components/ShoppingList";
import ToastContainer from "@/components/Toast";
import { getSiteUrl, isAdSenseEnabled } from "@/lib/seo";
import "./globals.css";

const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "4épices - Recettes faciles, rapides et gourmandes",
    template: "%s | 4épices",
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
    title: "4épices",
    description:
      "Recettes faciles, rapides et gourmandes pour tous les jours.",
    url: siteUrl,
    siteName: "4épices",
    locale: "fr_FR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "4épices",
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

  return (
    <html lang="fr">
      <body>
        {adsEnabled && (
          <Script
            async
            src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-9219883229313117"
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        )}
        <Navigation />
        {children}
        <ShoppingList />
        <ToastContainer />
        <footer className="bg-gray-800 text-white mt-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400 text-sm">
                © {new Date().getFullYear()} 4épices. Tous droits réservés.
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
