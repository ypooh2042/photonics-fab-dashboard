import NavLink from "@/components/NavLink";
import ExtractionMenu from "@/components/ExtractionMenu";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-6 flex items-center gap-4 text-sm border-b border-amber-500/30 pb-3">
        <span className="font-semibold text-amber-500">유지보수 모드</span>
        <NavLink href="/admin/projects">프로젝트</NavLink>
        <NavLink href="/admin/chips">칩 런 관리</NavLink>
        <NavLink href="/admin/recipes">레시피 위키</NavLink>
        <NavLink href="/admin/settings">노광 설정</NavLink>
        <ExtractionMenu />
        <NavLink href="/" exact className="ml-auto">
          대시보드로
        </NavLink>
      </div>
      {children}
    </div>
  );
}
