import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "4épices - Recettes Culinaires",
  description: "Découvrez nos délicieuses recettes culinaires",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body>
        {children}
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

