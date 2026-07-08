import type { Metadata } from "next";
import "./globals.css";
import Header from "./Header";

export const metadata: Metadata = {
  title: "Mortgage Case Review",
  description: "Auto Mortgage Loan Case Review System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-white text-neutral-900">
        <Header />
        {children}
      </body>
    </html>
  );
}
