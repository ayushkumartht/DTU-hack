import type { Metadata } from "next";
import { Playfair_Display, Inter, Geist, Noto_Sans_Devanagari, Poppins } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import "@/components/arc/foundation.css";
import { cn } from "@/lib/utils";

// Runs before hydration so a stored "dark" preference applies before first
// paint instead of flashing light, then correcting.
const THEME_INIT_SCRIPT = `
try {
  var stored = localStorage.getItem('theme');
  var theme = stored === 'dark' || stored === 'light'
    ? stored
    : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
} catch (e) {}
`;

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// Inter has no Devanagari glyphs; listing this after it in a font stack renders Hindi cleanly.
const devanagari = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-devanagari",
  display: "swap",
});

// Headings on the landing page: a familiar, widely used sans-serif.
const poppins = Poppins({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Learning of Vivekanand",
  description: "A minimal digital sanctuary presenting the profound teachings and philosophy of Swami Vivekananda.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-accent="neutral"
      // data-theme is set by the blocking init script below, before hydration,
      // from localStorage / prefers-color-scheme — expected to differ from
      // the server-rendered markup, so React shouldn't warn about it.
      suppressHydrationWarning
      className={cn(playfair.variable, inter.variable, devanagari.variable, poppins.variable, "font-sans", geist.variable)}
    >
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        {children}
      </body>
    </html>
  );
}

