import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bots",
  description: "Asana → Google Chat automation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
