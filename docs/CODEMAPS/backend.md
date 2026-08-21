# Backend 코드맵 (API + lib + 인증)

**마지막 업데이트:** 2026-08-21
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
  route.ts                          큐 조회 (`?week=` 없으면 활성 주차 = 백로그 뷰)
  weeks/route.ts                    주차 목록 (`listWeeks()`) — "지나간 노광 리스트" 피커
  [id]/route.ts                     신청 상세/수정
  [id]/complete/route.ts            POST `{ weekId }` — 노광 완료 처리 (completeSubmission)
  [id]/download/route.ts            GDS 다운로드
photos/[id]/route.ts                사진 바이너리 (24h 캐시, id 키)
equipment-users/[id]/route.ts       장비 사용자 조회
equipment-users/[id]/week-loading/route.ts   주간 로딩 시간 (`?week=`, 기본 활성 주차)
chip-layout/                        e-beam mock 배치 (jobs/chips/exposure-jobs/patterns/…)
  jobs/route.ts (`?week=`), jobs/[jobId]/…
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
  recipe-events/route.ts            레시피 이벤트 마커 목록(?category=&recipeName=)/생성
  recipe-events/[id]/route.ts       이벤트 마커 수정(PATCH)/삭제(DELETE)
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
| `data.ts` | 칩 런/레시피 읽기 뷰 | `listChipRuns`, `getChipRunDetail`, `listRecipeCategories`, `getRecipeEntryMode`, `getRecipeEvents` |
| `admin-data.ts` (~40KB) | 칩 런/스테이지/레시피 편집 로직 | `updateStage`, `addStage`, `reorderStages`, `updateRecipeEntry`, `listRecipeEvents`, `createRecipeEvent`, `updateRecipeEvent`, `deleteRecipeEvent`, 리뷰 뷰 |
| `queue.ts` (~30KB) | 노광 백로그/주차 용량 스냅샷/재계산/완료 처리 | `getWeeklySettings`, `getActiveWeekId`, `recomputeWeekUser`, `getQueueSections`, `createSubmission`, `completeSubmission`, `listWeeks`, `runManualCutover` |
| `chip-layout.ts` (~50KB) | 카세트 윈도우/배치/패턴 슬롯/패턴 스냅샷 | `createJob`, `listJobs(equipmentUserId, weekId?)`, `assignPatternSlot`, `listPatternCandidates`, `refreshPatternSnapshotForUserWeek`, `pruneOrphanedPlacementsForUserWeek`, `generateJobPreviewSvgs` (윈도우 정의는 내부 전용) |
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

## 노광 큐 = 누적 백로그 모델 (`lib/queue.ts`)

`layout_submissions.status`는 `'pending' | 'completed'` 두 값만 씁니다.

- **pending = 백로그.** 대기 중인 신청은 **주차로 분할되지 않습니다.** 장비 사용자별로
  하나의 백로그에 계속 쌓이며, `assigned_week_id`(처음 신청된 주차)로 필터링하지
  않습니다. 스케줄링은 **항상 현재 활성 주차의 용량 스냅샷** 기준으로 수행됩니다
  (`recomputeWeekUser(getActiveWeekId(), userId)`).
- **completed = 노광 완료 이력.** `completeSubmission(id, completedWeekId)`가
  `status='completed'`로 바꾸고, `assigned_week_id`를 장비 사용자가 고른 주차(실제
  노광이 돌아간 주차)로 **재배정**하며 `completed_at`을 찍습니다. 즉 완료된 신청의
  `assigned_week_id`는 "신청된 주차"가 아니라 "노광된 주차"입니다.

| 함수 | 역할 |
|------|------|
| `recomputeWeekUser(weekId, userId)` | 그 사용자의 **전체 pending 백로그**를 `weekId` 용량으로 FCFS 재스케줄 + 색상 갱신 |
| `recomputeAllBacklogUsers(weekId)` (내부) | pending이 있는 사용자 ∪ `weekId` 스냅샷이 있는 사용자 전부에 대해 위를 실행 |
| `listWeeks()` | 큐가 존재했던 모든 주차 (`weekId`, `label`, `isOpen`), 최신순 — 주차 피커용 |
| `getQueueSections(weekId)` | 아래 "주차 뷰 이중 의미" 참고 |
| `completeSubmission(id, completedWeekId)` | 완료 처리 → 백로그 재계산 + 패턴 스냅샷 갱신 |
| `runManualCutover()` | 수동 이월 (신청을 옮기지 않음 — 아래 참고) |

### 주차 뷰의 이중 의미 (`getQueueSections`)

같은 함수가 요청된 주차에 따라 **다른 것**을 보여줍니다:

| 요청 주차 | 보여주는 것 | 로드 합계 |
|-----------|-------------|-----------|
| 활성 주차 (`getActiveWeekId()`) | 누적된 **pending 백로그 전체** (원래 주차 무관) | `getBacklogLoadSummaryForUser` |
| 그 외(닫힌) 주차 | 그 주차에 **`completed`로 명시 기록된** 신청만 | `getCompletedLoadSummaryForWeek` |

> **"지나간 주차" 의미 변경:** 과거 주차 조회는 더 이상 "그때 대기 중이던 목록"이
> 아니라 **읽기 전용 노광 완료 이력**입니다. 완료 기록이 없는 과거 주차는 (영구
> 사용자 섹션을 빼면) 비어 보이는 것이 정상입니다. UI도 이에 맞춰 과거 주차에서는
> 삭제 버튼을 숨깁니다 ([frontend.md](./frontend.md) `QueueTable.tsx`).

### 이월(cutover)이 하는 일 / 하지 않는 일

`runManualCutover()` (그리고 인제스천 쪽 `checkAndRunCutover()`)는:

1. 새 주차를 `open`으로 생성 (`ensureWeek` — 영구 사용자 용량/로딩 스냅샷 시드)
2. 이전 주차를 `closed`로 마킹 + `last_cutover_run_at` 갱신
3. `recomputeAllBacklogUsers(toWeekId)` — 백로그를 새 주차 용량으로 재스케줄/재색칠

**하지 않는 일:** 미완료 신청을 주차 간에 강제 이동시키지 않습니다. pending 항목은
누가 `completeSubmission`으로 노광 완료를 기록할 때까지 백로그에 남습니다.
(`CutoverResult`에 `movedCount`가 더 이상 없습니다.)

## 패턴 스냅샷 · orphan prune 규칙 (`lib/chip-layout.ts`)

`chip_layout_placement_instances.pattern_key`는 FK가 아니라 그 배치의 주차 큐에서
파생되는 문자열이라, 큐가 바뀌면 배치가 "고아"가 될 수 있습니다. 이 때문에 두 가지
규칙이 코드에 못박혀 있습니다.

**(1) 읽기는 절대 삭제하지 않는다.** 과거 `getPatternCandidates()`가
`pruneOrphanedPlacementInstances`를 호출해, 단순 페이지 조회만으로 실제 배치 행이
조용히 삭제되던 버그가 있었습니다(후보를 잘못된 주차 기준으로 계산 → 전부 고아로
보임). 이제 prune은 **읽기 경로에서 완전히 제거**되었고, 명시적 변경 지점에서만
`pruneOrphanedPlacementsForUserWeek(equipmentUserId, weekId)`로 호출합니다 —
현재 유일한 호출처는 `queue.ts`의 `deleteSubmission`입니다.

**(2) 닫힌 주차의 후보 목록은 얼린다.** `getPatternCandidates(batchId)`는 배치의
주차 상태를 보고 분기합니다.

- `weekly_queue_weeks.status = 'open'` → 매번 실시간 계산 (`listPatternCandidatesInternal`).
- `'closed'` → `getOrCreateFrozenPatternSnapshot(batchId)`: `chip_layout_pattern_snapshots`에
  스냅샷이 있으면 그대로, 없으면 **그 시점 후보를 그대로 얼려서 insert**. insert 전용이며
  읽기가 삭제하는 일은 없습니다.
- `refreshPatternSnapshotForUserWeek(equipmentUserId, weekId)` — 이미 닫힌 주차로
  `completeSubmission`이 완료 기록을 넣었을 때만 그 (사용자, 주차) 배치의 스냅샷을
  지우고 다시 얼립니다. 열린 주차면 no-op.

> 후보 계산(`computeRawCandidates`)은 **배치 자신의 `week_id`** 기준이며(전역 활성
> 주차가 아님 — 과거 배치가 이번 주 후보를 보여주던 버그의 원인),
> `status IN ('pending','completed')`를 모두 패턴 소스로 인정합니다. 노광 완료
> 처리가 그 GDS의 패턴을 배치 화면에서 사라지게 만들면 안 되기 때문입니다.

## 코딩 규약 관찰

- DB 접근은 동기 (better-sqlite3). 라우트 핸들러에서 `await` 불필요한 DB 호출 다수.
- 파일 구성상 대형 도메인 모듈(`chip-layout.ts`, `admin-data.ts`)이 존재 —
  기능/도메인별 분리 원칙에 따라 나뉘어 있습니다.

## 관련 영역

- [frontend.md](./frontend.md) — 이 라우트를 소비하는 페이지/컴포넌트
- [database.md](./database.md) — lib이 읽고 쓰는 테이블
- [integrations.md](./integrations.md) — `gds-client.ts` → FastAPI
- [workers.md](./workers.md) — 인제스천/cutover가 같은 DB에 씀
