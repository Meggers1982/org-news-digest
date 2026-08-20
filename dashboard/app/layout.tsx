import type { Metadata } from "next";
import "./globals.css";
import "./dashboard.css";

export const metadata: Metadata = {
  title: "News Digest",
  description: "Daily press-highlights and org-watch digest",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
