import type { Metadata } from "next";
import "./globals.css";
import AppShell from "./AppShell";

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
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
