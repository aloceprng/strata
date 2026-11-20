import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import "./strata.css";
import "./commerce.css";

export const metadata: Metadata = {
  title: "strata",
  description: "design system",
};

// strata's own ui font; brand screens use token fonts
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-strata",
});

const BRAND_FONTS =
  "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={poppins.variable}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={BRAND_FONTS} />
      </head>
      <body>{children}</body>
    </html>
  );
}
