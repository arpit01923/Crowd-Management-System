import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Crowd Management System",
  description: "Live occupancy, demographics and entry/exit analytics",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
