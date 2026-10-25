import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { themeScript } from "@/lib/theme";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "UniPath — Your degree. Your direction.", template: "%s · UniPath" },
  description:
    "Track your courses, understand prerequisites, and build a smarter semester plan — all in one place.",
};

export const viewport: Viewport = {
  themeColor: "#050b11",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-scroll-behavior: smooth scrolling for in-page links, instant jumps on route changes.
    <html
      lang="en"
      data-theme="dark"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${inter.variable} ${mono.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      {/* Browser extensions (e.g. Grammarly) add attributes to <body> before React loads. */}
      <body className="min-h-full" suppressHydrationWarning>
        <div aria-hidden className="backdrop-aurora" />
        {children}
        <Toaster
          position="bottom-center"
          toastOptions={{
            className:
              "!glass-pop !text-fg !border !border-line-strong !rounded-2xl !font-sans",
            actionButtonStyle: { background: "var(--accent)", color: "var(--accent-fg)", fontWeight: 600 },
          }}
          offset={{ bottom: 88 }}
          mobileOffset={{ bottom: 88 }}
        />
      </body>
    </html>
  );
}
