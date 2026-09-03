import type { Metadata } from "next";
import "./globals.css";
import "./dashboard.css";

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
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
