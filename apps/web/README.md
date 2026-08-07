# apps/web — Fab Dashboard 웹앱

fab-dashboard 모노레포의 메인 애플리케이션입니다. Next.js 16 App Router 기반이며,
공정 진행 상황 · 레시피 위키 · e-beam 노광 큐/레이아웃을 제공합니다.

> **먼저 읽기 — Next.js 버전 경고:** 이 프로젝트의 Next.js(16.2.11)는 학습 데이터의
> 기대와 다른 API/규약/파일 구조를 가질 수 있습니다. 코드를 작성하기 전에
> [AGENTS.md](AGENTS.md)를 읽고, 해당 기능의 가이드를 `node_modules/next/dist/docs/`
> 에서 확인하세요. deprecation 안내를 반드시 따르세요.
>
> 대표적으로 헷갈리는 지점: 인증 미들웨어는 `middleware.ts`가 아니라 **`proxy.ts`**
> 이며, export 함수도 `middleware`가 아니라 **`proxy`**입니다.

## 실행

레포 루트에서:

```bash
npm run dev        # 개발 서버 (기본 :3000, 배포는 :8001)
npm run build      # 프로덕션 빌드
npm run start      # next start
```

환경변수/DB 초기화 등 전체 설정은 루트 [README.md](../../README.md)를 참고하세요.
이 앱은 루트 `.env.example` 기반의 `apps/web/.env.local`을 읽습니다.

## 디렉터리 구조

```
apps/web/
├── proxy.ts                인증 게이트 (Next 16의 middleware 후속, export=proxy)
├── next.config.ts          serverExternalPackages, transpilePackages, proxyClientMaxBodySize
├── app/
│   ├── layout.tsx          루트 레이아웃 (<html lang="ko">, Geist 폰트)
│   ├── (public)/login/     비인증 로그인
│   ├── (dashboard)/        인증 필요 페이지 + 상단 네비게이션
│   └── api/                라우트 핸들러 (auth / submissions / queue / chip-layout / admin …)
├── components/             UI 컴포넌트
└── lib/                    서버측 도메인 로직 (db, auth, data, queue, chip-layout …)
```

자세한 페이지/컴포넌트/라우트/lib 맵은 코드맵을 보세요:

- [docs/CODEMAPS/frontend.md](../../docs/CODEMAPS/frontend.md) — 페이지/컴포넌트/네비게이션
- [docs/CODEMAPS/backend.md](../../docs/CODEMAPS/backend.md) — API 라우트, lib, 인증

## 인증 개요

- 세션: JWT(`jose`) 쿠키 `fab_session`, 역할 `viewer`/`admin` (`lib/auth.ts`).
- 게이트: `proxy.ts`가 비로그인/비관리자 접근을 차단.
- operator 2차 잠금: `/admin/extraction/*` 및 `/api/admin/ingestion*`는 admin 역할에
  더해 별도 쿠키 `fab_operator_session`이 필요 (베타 LLM 추출 서브섹션).
- 쿠키 Secure는 `COOKIE_SECURE=true`일 때만 (LAN 평문 HTTP 배포에서 로그인이
  깨지지 않도록 `NODE_ENV`가 아닌 명시적 env로 제어).

## next.config.ts 주의점

- `serverExternalPackages: ["better-sqlite3"]` — 네이티브 모듈 번들 제외.
- `transpilePackages: ["@fab-dashboard/scheduling"]` — 워크스페이스 TS 소스 직접 소비.
- `experimental.proxyClientMaxBodySize: "50mb"` — proxy가 요청 본문을 메모리에
  버퍼링(기본 10MB)하는데, 큰 GDS 업로드가 조용히 잘려 form-data가 깨지던 문제를
  피하려고 nginx `client_max_body_size`(50m)에 맞춤.

## 데이터 접근

`lib/db.ts`의 `getDb()`가 better-sqlite3 싱글턴을 반환합니다(동기). 경로는 `DB_PATH`
env(기본 `../../data/fab_dashboard.sqlite`). 스키마는 루트 `db/schema.sql`.
테이블 상세는 [docs/CODEMAPS/database.md](../../docs/CODEMAPS/database.md).
