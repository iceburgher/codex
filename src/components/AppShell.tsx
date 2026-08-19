"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { IconBars, IconGrid, IconHouse, IconSliders, Logo } from "./Icons";

const NAV = [
  { href: "/", label: "Projekt", Icon: IconGrid },
  { href: "/compare", label: "Jämför", Icon: IconBars },
  { href: "/settings", label: "Skatteuppgifter", Icon: IconSliders },
];

/**
 * Flytande ikonrail till vänster och luftig yta till höger, i stället för en
 * bred menykolumn som äter av innehållet.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="mx-auto flex w-full max-w-[1500px] gap-5 px-4 py-5 sm:px-6">
      <nav className="no-print sticky top-5 hidden h-fit flex-col items-center gap-2 rounded-[28px] bg-surface px-2.5 py-4 shadow-[var(--shadow-card)] md:flex">
        <Link href="/" className="mb-3 text-accent-strong" aria-label="Start">
          <Logo className="h-8 w-8" />
        </Link>

        {NAV.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-label={label}
              aria-current={active ? "page" : undefined}
              className={`flex h-11 w-11 items-center justify-center rounded-2xl transition-colors ${
                active
                  ? "bg-ink text-white"
                  : "text-muted hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}

        <span className="mt-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-accent-soft text-accent-strong">
          <IconHouse className="h-5 w-5" />
        </span>
      </nav>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
