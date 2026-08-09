"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/LanguageContext";

export default function ExtractionMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const isActive = pathname.startsWith("/admin/extraction");
  const { t } = useLanguage();

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={isActive ? "font-bold opacity-100" : "opacity-80 hover:opacity-100"}
      >
        {t("extractionMenuLabel")} <span className="text-xs">▾</span>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-1 w-40 rounded-md border border-black/10 dark:border-white/15 bg-white dark:bg-neutral-900 shadow-lg py-1 text-sm z-10"
        >
          <Link
            href="/admin/extraction/review"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
          >
            {t("extractionReviewLabel")}
          </Link>
          <Link
            href="/admin/extraction/log"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 hover:bg-black/5 dark:hover:bg-white/10"
          >
            {t("extractionLogLabel")}
          </Link>
        </div>
      )}
    </div>
  );
}
