import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Montecristo Casting - Catálogo",
  description: "Catálogo visual de perfiles para casting, actores y extras."
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}


