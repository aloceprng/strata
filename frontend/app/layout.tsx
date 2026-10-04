import type { Metadata } from "next";
import "./globals.css";
import "./strata.css";

export const metadata: Metadata = {
  title: "strata",
  description: "design system",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
