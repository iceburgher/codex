import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { ProjectStoreProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "Fastighetskalkylen",
  description:
    "Jämför privat ägande, bolag och projektbolag för svenska fastighetsprojekt — hela ekonomin efter skatt.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="sv" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <ProjectStoreProvider>
          <header className="no-print border-b border-border bg-surface">
            <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-4 px-5 py-3">
              <Link href="/" className="text-base font-semibold tracking-tight">
                Fastighetskalkylen
              </Link>
              <nav className="flex items-center gap-5 text-sm text-muted">
                <Link href="/" className="hover:text-foreground">
                  Projekt
                </Link>
                <Link href="/compare" className="hover:text-foreground">
                  Jämför
                </Link>
                <Link href="/settings" className="hover:text-foreground">
                  Skatteuppgifter
                </Link>
              </nav>
            </div>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="no-print border-t border-border px-5 py-4 text-xs leading-relaxed text-muted">
            Beslutsstöd, inte skatterådgivning. Utfallet beror på syfte, användning och
            omständigheter — stäm av klassificering, moms, förmånsvärde och gränsbelopp med en
            skatterådgivare innan ni förlitar er på siffrorna.
          </footer>
        </ProjectStoreProvider>
      </body>
    </html>
  );
}
