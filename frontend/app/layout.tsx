import type { Metadata } from "next";
import "./globals.css";
import "./strata.css";
import "./commerce.css";

export const metadata: Metadata = {
  title: "strata",
  description: "design system",
};

const BRAND_FONTS =
  "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={BRAND_FONTS} />
      </head>
      <body>{children}</body>
    </html>
  );
}
