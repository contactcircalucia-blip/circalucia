import type { Metadata } from "next";
import "./globals.css";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AdminAccessGuard from "@/components/AdminAccessGuard";

export const metadata: Metadata = {
  title: "Circa Lucia — Crafted as You Imagined",
  description:
    "Circa Lucia creates bespoke and designed luxury footwear for women who want something distinctly their own.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AdminAccessGuard>
          <Header />

          <main>{children}</main>

          <Footer />
        </AdminAccessGuard>
      </body>
    </html>
  );
}