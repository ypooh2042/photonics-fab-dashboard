"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLanguage } from "@/components/LanguageContext";

function UnlockForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/operator-unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    setLoading(false);
    if (!res.ok) {
      setError(t("loginError"));
      return;
    }
    router.push(searchParams.get("next") ?? "/admin/extraction/review");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-sm flex flex-col gap-4 rounded-lg border border-black/10 dark:border-white/15 p-6"
    >
      <h1 className="text-lg font-semibold">{t("extractionMenuLabel")}</h1>
      <p className="text-sm text-amber-500">{t("operatorUnlockHint")}</p>
      <input
        type="password"
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder={t("operatorPasswordPlaceholder")}
        className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 outline-none focus:border-blue-500"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        type="submit"
        disabled={loading || !password}
        className="rounded-md bg-blue-600 text-white py-2 disabled:opacity-50"
      >
        {loading ? t("loginChecking") : t("confirm")}
      </button>
    </form>
  );
}

export default function OperatorUnlockPage() {
  return (
    <div className="flex items-center justify-center py-16">
      <Suspense>
        <UnlockForm />
      </Suspense>
    </div>
  );
}
