# fab-dashboard 코드맵 인덱스

**마지막 업데이트:** 2026-08-21
**저장소:** https://github.com/ypooh2042/photonics-fab-dashboard

포토닉스 반도체 공정(fab) 진행 상황, 레시피 위키, e-beam 노광 큐/레이아웃을 관리하는
내부 대시보드입니다. Obsidian 볼트의 랩노트를 LLM으로 추출해 SQLite에 채우고, Next.js
대시보드로 조회/편집합니다.

> **주의 (Next.js 버전):** 이 프로젝트는 Next.js 16을 사용하며, 일부 API/규약이
> 학습 데이터의 기대와 다릅니다. `apps/web/AGENTS.md`를 반드시 먼저 읽고, 코드를
> 작성하기 전에 `node_modules/next/dist/docs/`에서 해당 가이드를 확인하세요.
> 특히 `middleware.ts`는 이 버전에서 `proxy.ts`로 이름이 바뀌었고, export 함수도
> `middleware`가 아니라 `proxy`입니다.

## 모노레포 구조

```
fab-dashboard/
├── apps/web/                 Next.js 16 App Router 대시보드 (메인 앱)
├── packages/ingestion/       Obsidian 랩노트 → SQLite 인제스천 (LLM 추출)
├── packages/scheduling/      FCFS 노광 큐 스케줄링 로직 (+ 단위 테스트)
├── services/gds-analyzer/    Python/FastAPI GDS 레이아웃 분석 사이드카
├── db/schema.sql             SQLite 스키마 (수동 관리, 마이그레이션 도구 없음)
├── deploy/                   nginx / systemd / cron 배포 설정
├── scripts/                  init-db.sh, hash-password.ts
├── data/                     SQLite 파일 + 업로드/백업 (gitignore)
└── logs/                     서비스 로그 (gitignore)
```

npm workspaces 모노레포입니다 (`workspaces: ["apps/web", "packages/*"]`).
`services/gds-analyzer`는 별도 Python venv로 독립 실행되는 사이드카입니다.

## 코드맵 목록

| 코드맵 | 다루는 범위 |
|--------|-------------|
| [frontend.md](./frontend.md) | `apps/web` 페이지, 컴포넌트, 라우트 그룹, 네비게이션 |
| [backend.md](./backend.md) | `apps/web/app/api` 라우트 트리, `apps/web/lib` 도메인 로직, 인증 |
| [database.md](./database.md) | `db/schema.sql` 테이블, 관계, 시드 데이터 |
| [integrations.md](./integrations.md) | GDS 분석 사이드카, Claude CLI 기반 LLM 추출 |
| [workers.md](./workers.md) | 인제스천 파이프라인, 주간 이월(cutover), cron/systemd |

### 도메인 규칙이 문서화된 곳 (헷갈리기 쉬운 것)

| 규칙 | 위치 |
|------|------|
| 노광 큐는 주차별 목록이 아니라 **누적 백로그** — 이월이 미완료 신청을 옮기지 않음 | [backend.md](./backend.md) · [workers.md](./workers.md) |
| 과거 주차 조회 = "그때 대기 목록"이 아니라 **노광 완료 이력**(읽기 전용) | [backend.md](./backend.md) · [frontend.md](./frontend.md) |
| 칩 레이아웃 **읽기는 절대 삭제하지 않음** (prune은 명시적 변경 지점에서만) | [backend.md](./backend.md) |
| 닫힌 주차 배치의 패턴 후보는 `chip_layout_pattern_snapshots`에 **동결** | [database.md](./database.md) |
| 측정된 숫자일 때만 넣는 LLM 추출 필드 3종 (selectivity 자동 계산 입력) | [integrations.md](./integrations.md) |

## 아키텍처 개요

```
                    Obsidian Vault (랩노트 .md)
                            │
             cron(3h) │ packages/ingestion (run-update.ts)
                            │  extractNote → claude CLI (-p)
                            ▼
        ┌──────────────────────────────────────┐
        │  data/fab_dashboard.sqlite            │
        │  (better-sqlite3, 단일 파일, WAL)      │
        └──────────────────────────────────────┘
              ▲                        ▲
              │ getDb (동기)            │ getDb (동기)
        apps/web/lib/*            packages/ingestion/*
              │                        ▲
   Next.js 16 App Router         cron(1h) cutover-check
   apps/web/app/**               (주차 열고/닫기 + 백로그 재스케줄,
      │                            미완료 신청은 이월하지 않음)
      │  proxy.ts (인증 게이트)
      ▼
   nginx + Let's Encrypt  →  fab.yourdomain.example
      │
   systemd --user: fab-dashboard-web.service (:8001)
                   fab-dashboard-gds.service (:8003, 내부 전용)
      │  lib/gds-client.ts (fetch)
      ▼
   services/gds-analyzer (FastAPI, gdsfactory) — GDS 파싱/변환
```

## 핵심 기술 스택

- **웹:** Next.js 16.2.11, React 19.2.4, TypeScript 5, Tailwind CSS 4
- **DB:** better-sqlite3 11 (동기), 단일 파일 `data/fab_dashboard.sqlite`
- **인증:** JWT 세션 (`jose`), bcrypt 비밀번호 해시, 역할 `admin`/`viewer`
- **인제스천:** tsx로 실행되는 TS 스크립트, `claude -p` CLI로 LLM 추출
- **스케줄링:** 순수 TS 라이브러리 (vitest 단위 테스트)
- **GDS 서비스:** Python 3.12, FastAPI, uvicorn, gdsfactory 9

## 관련 문서

- 루트 [README.md](../../README.md) — 설치/실행/운영 개요
- [apps/web/README.md](../../apps/web/README.md) — 웹앱 상세
- [apps/web/AGENTS.md](../../apps/web/AGENTS.md) — Next.js 버전 경고 (필독)
- [deploy/README.md](../../deploy/README.md) — 배포 체크리스트
