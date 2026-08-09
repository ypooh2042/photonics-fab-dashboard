import NavLink from "@/components/NavLink";
import ExtractionMenu from "@/components/ExtractionMenu";
import { getServerLang } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const lang = await getServerLang();
  const t = (key: Parameters<typeof translate>[0]) => translate(key, lang);
  return (
    <div>
      <div className="mb-6 flex items-center gap-4 text-sm border-b border-amber-500/30 pb-3">
        <span className="font-semibold text-amber-500">{t("adminModeLabel")}</span>
        <NavLink href="/admin/projects">{t("adminProjects")}</NavLink>
        <NavLink href="/admin/chips">{t("adminChipRuns")}</NavLink>
        <NavLink href="/admin/recipes">{t("adminRecipeWiki")}</NavLink>
        <NavLink href="/admin/settings">{t("adminSettings")}</NavLink>
        <ExtractionMenu />
        <NavLink href="/" exact className="ml-auto">
          {t("navDashboard")}
        </NavLink>
      </div>
      {children}
    </div>
  );
}
