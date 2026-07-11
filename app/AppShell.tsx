"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/banks", label: "Banks" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:w-56 md:flex-col md:fixed md:inset-y-0 md:border-r md:border-neutral-200 md:bg-neutral-50">
        <SidebarContent pathname={pathname} />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3">
        <Link href="/" className="text-sm font-semibold text-neutral-900">
          Mortgage Case Review
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Open menu"
          className="rounded-md p-1.5 text-neutral-700 hover:bg-neutral-100"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="6" x2="20" y2="6" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="18" x2="20" y2="18" />
          </svg>
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} aria-hidden />
          <aside className="absolute inset-y-0 left-0 w-64 bg-white border-r border-neutral-200 shadow-lg flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
              <span className="text-sm font-semibold text-neutral-900">Menu</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="rounded-md p-1.5 text-neutral-700 hover:bg-neutral-100"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </svg>
              </button>
            </div>
            <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="md:pl-56">{children}</div>
    </div>
  );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 p-4">
      <div className="px-2 mb-4 hidden md:block">
        <span className="text-sm font-bold tracking-tight text-neutral-900">Mortgage Case Review</span>
      </div>
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              active ? "bg-neutral-900 text-white" : "text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/cases/new"
        onClick={onNavigate}
        className="mt-3 rounded-md bg-neutral-900 px-3 py-2 text-center text-sm font-medium text-white hover:bg-neutral-700 transition-colors"
      >
        + New Case
      </Link>
    </nav>
  );
}
