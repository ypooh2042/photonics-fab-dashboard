# Frontend 코드맵

**마지막 업데이트:** 2026-08-07
**진입점:** `apps/web/app/layout.tsx` (루트), `apps/web/app/(dashboard)/layout.tsx`,
`apps/web/app/(public)/login/page.tsx`

Next.js 16 App Router 기반 대시보드입니다. UI/본문 텍스트는 한국어입니다.

> **Next.js 16 주의:** 이 버전은 학습 데이터와 다른 API가 있습니다. 컴포넌트/라우트
> 규약을 가정하기 전에 `apps/web/AGENTS.md`와 `node_modules/next/dist/docs/`를
> 확인하세요. 인증 미들웨어는 `middleware.ts`가 아니라 `apps/web/proxy.ts`입니다
> (자세한 내용은 [backend.md](./backend.md)).

## 라우트 그룹 구조

```
apps/web/app/
├── layout.tsx              루트 레이아웃 (Geist 폰트, <html lang="ko">)
├── globals.css             Tailwind 4 전역 스타일
├── (public)/               인증 불필요 영역
│   └── login/page.tsx      비밀번호 로그인 (viewer/admin)
├── (dashboard)/            인증 필요 영역 (proxy.ts가 게이트)
│   ├── layout.tsx          상단 네비게이션 헤더 + HeaderMenu
│   ├── page.tsx            홈: 칩 진행 상황
│   ├── recipes/            레시피 위키 (열람)
│   ├── submit/             노광 신청 (GDS 업로드)
│   ├── queue/              노광 큐 (주간 FCFS)
│   ├── chips/[chipRunId]/  칩 런 상세
│   ├── chip-layout/        e-beam mock 칩 배치 에디터
│   ├── layout-convert/     GDS negative→positive 변환 도구
│   └── admin/              관리자 전용 (role=admin)
└── api/                    → backend.md 참고
```

## 네비게이션 (dashboard/layout.tsx)

상단 헤더 nav 링크:

| 라벨 | 경로 | 페이지 |
|------|------|--------|
| 칩 진행 상황 | `/` | `(dashboard)/page.tsx` |
| 레시피 위키 | `/recipes` | `(dashboard)/recipes/page.tsx` |
| 노광 신청 | `/submit` | `(dashboard)/submit/page.tsx` |
| 노광 큐 | `/queue` | `(dashboard)/queue/page.tsx` |

`HeaderMenu`(우측)는 역할/관리자 메뉴 및 로그아웃을 담당합니다.

## 주요 페이지

| 경로 | 목적 |
|------|------|
| `(dashboard)/page.tsx` | 프로젝트별 칩 런 진행 상황 개요 |
| `recipes/page.tsx` → `[category]/[recipeName]/page.tsx` | 레시피 카테고리 → 레시피 상세/추세 |
| `submit/page.tsx` | GDS 업로드 + 노광 파라미터로 노광 신청 |
| `queue/page.tsx` → `queue/[id]/page.tsx` | 주간 노광 큐, 신청 상세 |
| `chips/[chipRunId]/page.tsx` | 칩 런 파이프라인 타임라인 + 사진 |
| `chip-layout/[equipmentUserId]/page.tsx` | 사용자별 카세트 윈도우 mock 배치 에디터 |
| `chip-layout/[equipmentUserId]/preview/[jobId]/page.tsx` | 배치 프리뷰 |
| `layout-convert/page.tsx` | GDS negative→positive 변환 UI |

## Admin 서브트리 (`(dashboard)/admin`, role=admin)

| 경로 | 목적 |
|------|------|
| `admin/page.tsx` | 관리자 홈 |
| `admin/chips/page.tsx`, `admin/chips/[chipRunId]/edit/page.tsx` | 칩 런/스테이지 편집 |
| `admin/recipes/…` | 레시피 정의/엔트리 편집 |
| `admin/projects/page.tsx` | 프로젝트 관리 |
| `admin/settings/page.tsx` | 주간 스케줄/장비 사용자/도즈/전류 설정 |
| `admin/extraction/unlock/page.tsx` | operator 2차 잠금 해제 (베타 LLM 추출) |
| `admin/extraction/review/page.tsx` | LLM 추출 결과 리뷰 |
| `admin/extraction/log/page.tsx` | 인제스천 로그 조회 |

> `admin/extraction/*`는 admin 역할에 더해 **별도의 operator 잠금**(별도 쿠키/JWT)이
> 필요합니다. 상세는 [backend.md](./backend.md) 인증 섹션 참고.

## 컴포넌트 (`apps/web/components/`)

| 컴포넌트 | 목적 |
|----------|------|
| `HeaderMenu.tsx`, `NavLink.tsx`, `ExtractionMenu.tsx` | 네비게이션/헤더 메뉴 |
| `ChipRunCard.tsx`, `PipelineTimeline.tsx` | 칩 진행 상황 표시 |
| `ChipRunAdminEditor.tsx` | 칩 런/스테이지 관리자 편집 |
| `RecipeAdminEditor.tsx`, `CreateRecipeForm.tsx`, `RecipeTrendChart.tsx` | 레시피 편집/추세(recharts) |
| `QueueTable.tsx` | 노광 큐 테이블 |
| `ChipLayoutEditor.tsx`, `WindowCanvas.tsx`, `LayoutGridPreview.tsx`, `ChipLayoutPreviewModal.tsx`, `ChipLayoutPreviewViewer.tsx` | 칩 배치 에디터/캔버스 (react-zoom-pan-pinch) |
| `EquipmentUserAdmin.tsx`, `EbeamCurrentAdmin.tsx`, `ResistDoseAdmin.tsx` | 설정 관리 폼 |
| `ProjectFilterSelect.tsx` | 프로젝트 필터 |
| `PhotoLightbox.tsx` | 사진 라이트박스 |

## 외부 의존성 (UI 관련)

- `next` 16.2.11, `react`/`react-dom` 19.2.4
- `tailwindcss` 4 (`@tailwindcss/postcss`)
- `recharts` 3 — 레시피 추세 차트
- `react-zoom-pan-pinch` 4 — 칩 배치 캔버스 줌/팬
- `@formkit/auto-animate` — 리스트 애니메이션
- `@fab-dashboard/scheduling` — 큐 색상/스케줄 계산 (transpilePackages)

## 데이터 흐름

서버 컴포넌트/라우트 핸들러가 `apps/web/lib/*`를 통해 SQLite를 동기 조회합니다
(better-sqlite3). 클라이언트 컴포넌트는 `/api/*`로 fetch 합니다. GDS 관련
클라이언트 상호작용은 `lib/gds-client.ts` → FastAPI 사이드카로 프록시됩니다.

## 관련 영역

- [backend.md](./backend.md) — API 라우트, lib 도메인 로직, 인증
- [database.md](./database.md) — 페이지가 읽는 테이블
- [integrations.md](./integrations.md) — GDS 변환/분석
