import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { ProjectStoreProvider } from "@/lib/store";

const poppins = Poppins({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Fastighetskalkylen",
  description:
    "Jämför privat ägande, bolag och projektbolag för svenska fastighetsprojekt — hela ekonomin efter skatt.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="sv" className={`${poppins.variable} h-full antialiased`}>
      <body
        className="min-h-full"
        style={{ fontFamily: "var(--font-poppins), ui-sans-serif, system-ui, sans-serif" }}
      >
        <ProjectStoreProvider>
          <AppShell>{children}</AppShell>
          <footer className="no-print mx-auto max-w-[1500px] px-6 pb-6 pt-1 text-xs leading-relaxed text-muted">
            Beslutsstöd, inte skatterådgivning. Utfallet beror på syfte, användning och
            omständigheter — stäm av klassificering, moms, förmånsvärde och gränsbelopp med en
            skatterådgivare innan ni förlitar er på siffrorna.
          </footer>
        </ProjectStoreProvider>
      </body>
    </html>
  );
}
