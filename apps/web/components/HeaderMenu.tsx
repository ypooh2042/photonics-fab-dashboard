"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageContext";

export default function HeaderMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  async function logout() {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("navMenu")}
        className="flex items-center text-sm opacity-80 hover:opacity-100 rounded-md border border-black/15 dark:border-white/20 px-3 py-1.5"
      >
        <span className="text-xs">▼</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-44 rounded-md border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 shadow-lg py-1 text-sm z-10"
        >
          <Link
            href="/layout-convert"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
          >
            {t("navLayoutConvert")}
          </Link>
          <Link
            href="/admin/projects"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
          >
            {t("navMaintenance")}
          </Link>
          <button
            onClick={logout}
            className="w-full text-left px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
          >
            {t("navLogout")}
          </button>
        </div>
      )}
    </div>
  );
}
