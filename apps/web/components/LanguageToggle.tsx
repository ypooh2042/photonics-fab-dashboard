"use client";

import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageContext";

export default function LanguageToggle() {
  const { lang, setLang, t } = useLanguage();
  const router = useRouter();

  function toggle() {
    const next = lang === "ko" ? "en" : "ko";
    setLang(next);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="shrink-0 text-xs opacity-80 hover:opacity-100 rounded-md border border-black/15 dark:border-white/20 px-2 py-1"
      title={lang === "ko" ? "Switch to English" : "한국어로 전환"}
    >
      {t("languageToggleLabel")}
    </button>
  );
}
