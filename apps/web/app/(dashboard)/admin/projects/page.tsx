"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/LanguageContext";

interface Project {
  id: number;
  slug: string;
  name: string;
  chipRunCount: number;
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { lang, t } = useLanguage();

  function load() {
    fetch("/api/admin/projects")
      .then((r) => r.json())
      .then(setProjects);
  }

  useEffect(load, []);

  async function addProject() {
    setError(null);
    setBusy(true);
    const res = await fetch("/api/admin/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, name }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? t("addFailed"));
      return;
    }
    setName("");
    setSlug("");
    setSlugEdited(false);
    load();
  }

  async function removeProject(p: Project) {
    const warned = confirm(
      lang === "ko"
        ? `"${p.name}" ${t("confirmDeleteProjectPrefix")} ${p.chipRunCount}${t("confirmDeleteProjectSuffix")}`
        : `"${p.name}" ${t("confirmDeleteProjectPrefix")} ${p.chipRunCount} ${t("confirmDeleteProjectSuffix")}`,
    );
    if (!warned) return;
    setBusy(true);
    await fetch(`/api/admin/projects/${p.id}`, { method: "DELETE" });
    setBusy(false);
    load();
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-semibold mb-4">{t("manageProjectsHeading")}</h1>

      <div className="flex flex-col gap-2 mb-6">
        {projects.map((p) => (
          <div
            key={p.id}
            className="flex items-center justify-between rounded-md border border-black/10 dark:border-white/15 px-3 py-2 text-sm"
          >
            <div>
              <span className="font-medium">{p.name}</span>
              <span className="opacity-50 ml-2">({p.slug})</span>
              <span className="opacity-50 ml-2">
                {lang === "ko" ? `${t("chipRunsLabel")} ${p.chipRunCount}개` : `${p.chipRunCount} ${t("chipRunsLabel")}`}
              </span>
            </div>
            <button onClick={() => removeProject(p)} disabled={busy} className="text-red-500 text-xs">
              {t("delete")}
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-dashed border-black/20 dark:border-white/25 p-4 flex flex-col gap-2">
        <p className="text-sm font-medium">{t("addNewProjectLabel")}</p>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugEdited) setSlug(slugify(e.target.value));
          }}
          placeholder={t("projectNamePlaceholder")}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm"
        />
        <input
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugEdited(true);
          }}
          placeholder={t("slugPlaceholder")}
          className="rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          onClick={addProject}
          disabled={busy || !name.trim() || !slug.trim()}
          className="rounded-md bg-blue-600 text-white py-2 text-sm disabled:opacity-50"
        >
          {t("add")}
        </button>
      </div>
    </div>
  );
}
