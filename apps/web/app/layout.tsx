import type { Metadata } from "next";
import Script from "next/script";
import "@sage/ui/styles.css";
export const metadata: Metadata = {
  title: "SAGE · Commentary inspector",
  description:
    "Inspect SAGE commentary from source facts to realization, using data on your own machine.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="system" suppressHydrationWarning>
      <body>
        <Script src="/theme.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
