import Link from "next/link";
import HeaderMenu from "@/components/HeaderMenu";
import NavLink from "@/components/NavLink";
import LanguageToggle from "@/components/LanguageToggle";
import { getServerLang } from "@/lib/i18n-server";
import { translate } from "@/lib/i18n";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const lang = await getServerLang();
  const t = (key: Parameters<typeof translate>[0]) => translate(key, lang);
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-black/10 dark:border-white/15 px-6 py-3 flex items-center gap-4">
        <Link href="/" className="font-semibold shrink-0">
          Fab Dashboard
        </Link>
        <nav className="nav-scroll min-w-0 flex-1 overflow-x-auto">
          <div className="flex items-center gap-5 text-sm w-max">
            <NavLink href="/" exact>
              {t("navChipProgress")}
            </NavLink>
            <NavLink href="/recipes">{t("navRecipeWiki")}</NavLink>
            <NavLink href="/submit">{t("navSubmit")}</NavLink>
            <NavLink href="/queue">{t("navQueue")}</NavLink>
          </div>
        </nav>
        <LanguageToggle />
        <HeaderMenu />
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
