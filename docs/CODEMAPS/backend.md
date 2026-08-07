# Backend 코드맵 (API + lib + 인증)

**마지막 업데이트:** 2026-08-07
**진입점:** `apps/web/proxy.ts` (인증 게이트), `apps/web/app/api/**/route.ts`,
`apps/web/lib/*`

Next.js 16 App Router의 라우트 핸들러 + 서버측 도메인 로직입니다. DB 접근은 모두
`apps/web/lib/db.ts`의 `getDb()`(better-sqlite3, 동기)를 통합니다.

## 인증 (중요)

### proxy.ts — Next 16의 middleware 후속

> Next.js 16에서 `middleware.ts`는 **`proxy.ts`로 이름이 바뀌었고**, export 함수도
> `middleware`가 아니라 **`proxy`**입니다. 이 점이 자주 혼동을 일으키므로 명시합니다.
> 파일: `apps/web/proxy.ts`, export: `export async function proxy(request)` +
> `export const config = { matcher: [...] }`.

`proxy.ts`의 게이트 순서:

1. `SESSION_COOKIE`(`fab_session`) JWT 검증 → 없으면 API는 401, 페이지는 `/login` 리다이렉트.
2. 경로가 `/admin` 또는 `/api/admin`이고 `role !== "admin"` → API 403, 페이지 `/login?admin=1`.
3. **operator 2차 게이트:** 경로가 `/admin/extraction/*`(unlock 페이지 제외) 또는
   `/api/admin/ingestion*`이면 `OPERATOR_COOKIE`(`fab_operator_session`) 추가 검증 →
   없으면 API 403, 페이지 `/admin/extraction/unlock` 리다이렉트.

`config.matcher`는 `login`, `api/auth`, `_next/static`, `_next/image`, `favicon.ico`를 제외합니다.

### lib/auth.ts

| Export | 목적 |
|--------|------|
| `SESSION_COOKIE = "fab_session"` | 일반 세션 쿠키명 |
| `OPERATOR_COOKIE = "fab_operator_session"` | operator 2차 게이트 쿠키명 |
| `Role = "viewer" \| "admin"` | 역할 타입 |
| `signSession(role)` / `verifySession(token)` | 7일 만료 HS256 JWT (jose) |
| `signOperatorSession()` / `verifyOperatorSession(token)` | operator 잠금 JWT |

secret은 `SESSION_SECRET` 환경변수. 비밀번호는 bcrypt 해시(`ADMIN_PASSWORD_HASH`,
`VIEWER_PASSWORD_HASH`, `OPERATOR_PASSWORD_HASH`)와 대조합니다.

> **쿠키 Secure 플래그:** `COOKIE_SECURE === "true"`일 때만 Secure로 설정합니다.
> LAN 평문 HTTP 배포에서 브라우저가 Secure 쿠키를 저장 거부해 로그인이 조용히
> 실패했던 이슈 때문에, `NODE_ENV`가 아니라 명시적 env로 제어합니다.

### 인증 라우트 (`api/auth`, matcher에서 제외됨)

| 라우트 | 동작 |
|--------|------|
| `POST /api/auth/login` | 비밀번호 → bcrypt 대조 → admin/viewer JWT 쿠키 설정 |
| `POST /api/auth/logout` | 세션 쿠키 삭제 |
| `POST /api/auth/operator-unlock` | operator 비밀번호 → operator JWT 쿠키 설정 |

## API 라우트 트리 (`apps/web/app/api`)

### 공개 도메인 (viewer 이상)

```
submissions/
  route.ts                          노광 신청 목록/생성
  upload/route.ts                   GDS 업로드 (GDS 사이드카로 분석)
  reference-data/route.ts           도즈/전류/장비사용자 등 참조 데이터
queue/
  route.ts                          주간 큐 조회
  [id]/route.ts                     신청 상세/수정
  [id]/download/route.ts            GDS 다운로드
photos/[id]/route.ts                사진 바이너리 (24h 캐시, id 키)
equipment-users/[id]/route.ts       장비 사용자 조회
equipment-users/[id]/week-loading/route.ts   주간 로딩 시간
chip-layout/                        e-beam mock 배치 (jobs/chips/exposure-jobs/patterns/…)
  jobs/route.ts, jobs/[jobId]/…
  exposure-jobs/[exposureJobId]/…
  chips/[chipId]/route.ts
  placement-instances/[instanceId]/route.ts
layout-convert/
  upload/route.ts, convert/route.ts, download/[filename]/route.ts
```

### 관리자 도메인 (`api/admin`, role=admin)

```
admin/
  chip-runs/…                       칩 런 CRUD, stages reorder, merge
  chip-run-photos/[crpId]/…         칩 런 사진 관리/이동
  stages/[stageId]/…                스테이지 편집/이동/사진 reorder
  recipes/…                         레시피 엔트리/정의/rename/entry-mode/description
  projects/[projectId]/route.ts     프로젝트 관리
  equipment-users/…                 장비 사용자 + capacities
  ebeam-currents/[currentNa]/…      e-beam 전류 프리셋
  resist-doses/[resistType]/…       레지스트 기준 도즈
  settings/route.ts                 주간 스케줄 설정
  cutover/route.ts                  수동 주간 이월 트리거
  ingestion/route.ts                인제스천 상태 (operator 잠금 필요)
  ingestion/reprocess/route.ts      노트 재처리 (operator 잠금 필요)
```

> `api/admin/ingestion*`은 admin + operator 2차 게이트 모두 필요 (proxy.ts).

## lib 도메인 로직 (`apps/web/lib/`)

| 파일 | 역할 | 대표 export |
|------|------|-------------|
| `db.ts` | better-sqlite3 싱글턴 (`DB_PATH` env) | `getDb()` |
| `auth.ts` | JWT 세션/operator 잠금 | 위 인증 표 참고 |
| `data.ts` | 칩 런/레시피 읽기 뷰 | `listChipRuns`, `getChipRunDetail`, `listRecipeCategories`, `getRecipeEntryMode` |
| `admin-data.ts` (~40KB) | 칩 런/스테이지/레시피 편집 로직 | `updateStage`, `addStage`, `reorderStages`, `updateRecipeEntry`, 리뷰 뷰 |
| `queue.ts` (~27KB) | 주간 큐/용량 스냅샷/재계산 | `getWeeklySettings`, `getActiveWeekId`, `recomputeWeekUser`, `getQueueSections`, `createSubmission` |
| `chip-layout.ts` (~45KB) | 카세트 윈도우/배치/패턴 슬롯 | `createJob`, `assignPatternSlot`, `generateJobPreviewSvgs` (윈도우 정의는 내부 전용) |
| `geometry.ts` | 공유 `GridBounds` 타입 (server/client 공용) | `GridBounds` |
| `chip-colors.ts` | 칩 색상 헬퍼 (client-safe, `chip-layout.ts` server-only 분리) | `chipFillColor` |
| `stage-constants.ts` | 스테이지 타입/상태 상수 + 타입 (client-safe) | `STAGE_TYPES`, `STAGE_STATUSES`, `StageType`, `StageStatus` |
| `equipment-users.ts` | 장비 사용자 CRUD + 용량 리밸런스 | `listEquipmentUsers`, `updateEquipmentUserCapacities`, `rebalancePermanentCapacities` |
| `gds-client.ts` | GDS 사이드카 fetch 클라이언트 | `analyzeGds`, `convertToPositive` |
| `photo-display.ts` | 사진 파일명 표시 | `displayFilename` |
| `audit.ts` | 감사 로그 기록 | `logAudit` |
| `scratch-cleanup.ts` | 임시 업로드 정리 | `sweepOldFiles` |

`@fab-dashboard/scheduling`(FCFS/주간 경계/해상도)은 `lib/queue.ts` 및 인제스천의
cutover에서 공유됩니다 — [workers.md](./workers.md) 참고.

## 코딩 규약 관찰

- DB 접근은 동기 (better-sqlite3). 라우트 핸들러에서 `await` 불필요한 DB 호출 다수.
- 파일 구성상 대형 도메인 모듈(`chip-layout.ts`, `admin-data.ts`)이 존재 —
  기능/도메인별 분리 원칙에 따라 나뉘어 있습니다.

## 관련 영역

- [frontend.md](./frontend.md) — 이 라우트를 소비하는 페이지/컴포넌트
- [database.md](./database.md) — lib이 읽고 쓰는 테이블
- [integrations.md](./integrations.md) — `gds-client.ts` → FastAPI
- [workers.md](./workers.md) — 인제스천/cutover가 같은 DB에 씀
