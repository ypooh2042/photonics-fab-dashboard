"use client";

import { useRouter, usePathname } from "next/navigation";
import { useLanguage } from "@/components/LanguageContext";

export default function ProjectFilterSelect({
  projects,
  selected,
}: {
  projects: { slug: string; name: string }[];
  selected: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <select
      value={selected}
      onChange={(e) => {
        const slug = e.target.value;
        router.push(slug ? `${pathname}?project=${encodeURIComponent(slug)}` : pathname);
      }}
      className="text-sm rounded-md border border-black/15 dark:border-white/20 bg-transparent px-3 py-2 max-w-[12rem] truncate"
    >
      <option value="">{t("allProjects")}</option>
      {projects.map((p) => (
        <option key={p.slug} value={p.slug}>
          {p.name}
        </option>
      ))}
    </select>
  );
}
