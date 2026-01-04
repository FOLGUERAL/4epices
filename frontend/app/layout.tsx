import type { Metadata } from "next";
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
      <body>{children}</body>
    </html>
  );
}

