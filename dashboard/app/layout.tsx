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
   Inlined rather than imported: a module would load after the first render.
   The stored value is the choice (system, light or dark); this resolves it to
   a concrete data-theme, the same way senior-research-digest's head script does.
   It also copies the collapsed section kinds onto data-collapsed, so
   dashboard.css can hide those sections before React runs (MEA-53). */
const THEME_INIT = `(function(){var c="system";try{c=localStorage.getItem("digest-theme")||"system"}catch(e){}
if(c!=="light"&&c!=="dark")c="system";
var d=c==="dark"||(c==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);
var r=document.documentElement;r.dataset.theme=d?"dark":"light";r.dataset.themeChoice=c;
try{var k=JSON.parse(localStorage.getItem("digest-collapsed")||"[]");if(Array.isArray(k))r.dataset.collapsed=k.join(" ")}catch(e){}})();`;

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
