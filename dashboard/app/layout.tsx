import type { Metadata } from "next";
import { Source_Sans_3 } from "next/font/google";
import "./globals.css";
import "./dashboard.css";

/* Source Sans 3 is what the other two dashboards set, and a shared palette is
   not shared if the type is not. next/font self-hosts it, so there is no
   render-blocking stylesheet and no third-party request on every view. */
const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "News Digest",
  description: "Daily press-highlights and org-watch digest",
};

/* Runs before first paint so a stored dark preference does not flash light.
   Inlined rather than imported: a module would load after the first render. */
const THEME_INIT = `(function(){try{var t=localStorage.getItem("digest-theme");
if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t}}catch(e){}})();`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`h-full antialiased ${sourceSans.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
