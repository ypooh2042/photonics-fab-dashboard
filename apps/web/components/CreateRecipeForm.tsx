"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CreateRecipeForm({ categorySlug }: { categorySlug: string }) {
  const router = useRouter();
  const [recipeName, setRecipeName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    if (!recipeName.trim()) return;
    setError(null);
    setBusy(true);
    const res = await fetch("/api/admin/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categorySlug, recipeName, description }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "생성 실패");
      return;
    }
    router.push(`/admin/recipes/${categorySlug}/${encodeURIComponent(recipeName.trim())}/edit`);
  }

  return (
    <div className="rounded-lg border border-dashed border-black/20 dark:border-white/25 p-4 flex flex-col gap-2">
      <p className="text-sm font-medium">새 레시피 생성</p>
      <input
        value={recipeName}
        onChange={(e) => setRecipeName(e.target.value)}
        placeholder="레시피 이름 (예: SiN_DH_ZEP520A)"
        className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm"
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="레시피 설명 (고정 조건, 선택)"
        rows={3}
        className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm"
      />
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        onClick={create}
        disabled={busy || !recipeName.trim()}
        className="rounded-md bg-blue-600 text-white py-2 text-sm disabled:opacity-50"
      >
        생성
      </button>
    </div>
  );
}
