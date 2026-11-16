import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Attestly — Security questionnaires for SaaS teams without a security team",
  description:
    "Upload the buyer's security questionnaire, get cited draft answers, review and export. $79 per questionnaire. No subscription, no sales call.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
