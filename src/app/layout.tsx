import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { ProjectStoreProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "Property Investment Calculator",
  description:
    "Compare private, company and project-company ownership of Swedish property projects on full after-tax economics.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <ProjectStoreProvider>
          <header className="no-print border-b border-border bg-surface">
            <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-2.5">
              <Link href="/" className="text-sm font-semibold tracking-tight">
                Property Investment Calculator
              </Link>
              <nav className="flex items-center gap-4 text-xs text-muted">
                <Link href="/" className="hover:text-foreground">
                  Projects
                </Link>
                <Link href="/compare" className="hover:text-foreground">
                  Compare
                </Link>
                <Link href="/settings" className="hover:text-foreground">
                  Tax config
                </Link>
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="no-print border-t border-border px-4 py-3 text-[11px] text-muted">
            Decision support only. Tax outcomes depend on facts, intent and usage — confirm
            classification, VAT treatment, benefit value and dividend allowance with a tax advisor
            before relying on any result.
          </footer>
        </ProjectStoreProvider>
      </body>
    </html>
  );
}
