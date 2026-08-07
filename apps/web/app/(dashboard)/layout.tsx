import Link from "next/link";
import HeaderMenu from "@/components/HeaderMenu";
import NavLink from "@/components/NavLink";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-black/10 dark:border-white/15 px-6 py-3 flex items-center gap-4">
        <Link href="/" className="font-semibold shrink-0">
          Fab Dashboard
        </Link>
        <nav className="nav-scroll min-w-0 flex-1 overflow-x-auto">
          <div className="flex items-center gap-5 text-sm w-max">
            <NavLink href="/" exact>
              칩 진행 상황
            </NavLink>
            <NavLink href="/recipes">레시피 위키</NavLink>
            <NavLink href="/submit">노광 신청</NavLink>
            <NavLink href="/queue">노광 큐</NavLink>
          </div>
        </nav>
        <HeaderMenu />
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
