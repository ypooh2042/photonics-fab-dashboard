# Workers 코드맵 (인제스천 · 스케줄링 · 배포 잡)

**마지막 업데이트:** 2026-08-21
**진입점:** `packages/ingestion/src/run-update.ts`, `run-cutover-check.ts`,
`backfill.ts`; `packages/scheduling/src/*`

백그라운드 처리: (1) 랩노트 인제스천 파이프라인, (2) 순수 스케줄링 라이브러리,
(3) 주간 노광 큐 이월(cutover), (4) cron/systemd 배포 잡.

## 1. 인제스천 파이프라인 (`packages/ingestion`)

Obsidian 볼트 랩노트 → LLM 추출 → SQLite. tsx로 실행되는 TS 스크립트 모음이며,
`type: module` ESM입니다.

### 소스 구성

| 파일 | 역할 |
|------|------|
| `run-update.ts` | **증분 실행** (cron 3h): 변경/신규 노트 감지 → 추출 → upsert |
| `backfill.ts` | 과거 노트 일괄 처리 (수동 스윕) |
| `cli-dry-run.ts` | 실제 쓰기 없이 추출 결과 미리보기 |
| `reprocess-one.ts` | 노트 하나 강제 재처리 |
| `run-cutover-check.ts` | 주간 경계 통과 여부 확인 → cutover 실행 (로그: `rolled over A -> B`) |
| `cutover.ts` | `checkAndRunCutover()` — 주차 열고/닫기 + 백로그 재스케줄 (아래 3장 참고) |
| `scan-notes.ts` | 노트 나열 + mtime/sha256 변경 감지 + 처리 상태 기록 |
| `extract.ts` | `claude -p` CLI 추출 ([integrations.md](./integrations.md)) |
| `upsert.ts` | 추출 JSON → chip_runs/stages/recipe_entries upsert, 노트 날짜 추론 |
| `photo-store.ts` | 노트 참조 사진을 앱 복사본으로 해석/저장 (`resolvePhoto`) |
| `db.ts` | better-sqlite3 싱글턴 (웹앱과 같은 파일) |
| `types.ts` | 추출 스키마 타입 |

### run-update 동작 (핵심)

- `TRACKING_START_DATE = "2026-07-22"` 이후 노트 + 이미 추적 중인 노트만 대상.
  그보다 오래된 노트는 증분 파이프라인 대상 외 — `backfill.ts`로 수동 스윕.
- `MAX_CONSECUTIVE_FAILURES = 3`: 3회 연속 실패한 노트는 건너뛰고 관리자 리뷰 대상.
- 각 노트: 읽기 → `extractNote(...)` → `upsertNoteExtraction(...)` → `markNoteProcessed(...)`.
- 성공/실패/스킵 카운트 로깅. 상태는 `note_ingestion_state` 테이블에 기록.

### 필요 환경변수

`VAULT_PATH`(볼트 경로), `DB_PATH`(SQLite), 그리고 `claude` CLI 로그인 상태.

### npm 스크립트 (루트 package.json)

| 스크립트 | 명령 |
|----------|------|
| `ingest:update` | `tsx packages/ingestion/src/run-update.ts` |
| `ingest:cutover` | `tsx packages/ingestion/src/run-cutover-check.ts` |
| `ingest:backfill` | `tsx packages/ingestion/src/backfill.ts` |
| `ingest:dry-run` | `tsx packages/ingestion/src/cli-dry-run.ts` |

## 2. 스케줄링 라이브러리 (`packages/scheduling`)

순수 TS, 부작용 없음. `main`/`exports`가 `src/*.ts` 직접 노출 (빌드 없이 소비,
웹앱에서는 `transpilePackages`로 처리). vitest 단위 테스트 포함.

| 파일 | 역할 | 테스트 |
|------|------|--------|
| `fcfs.ts` | FCFS 스케줄링 + 큐 색상(green/yellow/orange). `Job`, `ScheduleResult` | `fcfs.test.ts` |
| `week-boundary.ts` | cutover 시각/타임존 기준 주차 경계 계산 (`CutoverSettings`) | `week-boundary.test.ts` |
| `resolution.ts` | 도즈/전류 → 픽셀 해상도(스텝/드웰 floor) 계산 | `resolution.test.ts` |
| `index.ts` | 위 3개 re-export | — |

- 소비자: `apps/web/lib/queue.ts`(웹 큐 재계산), `packages/ingestion/src/cutover.ts`.
- 테스트 실행: 루트 `npm run test:scheduling` (`vitest run --root packages/scheduling`).

> **테스트 커버리지 주의:** 현재 자동화 테스트는 `packages/scheduling`에만 존재합니다.
> `apps/web`과 `packages/ingestion`에는 단위/통합/E2E 테스트가 없어, 전역 80%
> 커버리지 기준([~/.claude/rules/testing.md])에는 미달입니다.

## 3. 주간 이월 (cutover)

주간 경계를 넘겼는지 확인하고 큐 주차를 넘기는 파이프라인입니다. 진입점이 둘입니다:

| 경로 | 함수 | 트리거 |
|------|------|--------|
| 자동 | `packages/ingestion/src/cutover.ts` `checkAndRunCutover(now?)` | cron 매시 (`run-cutover-check.ts`) |
| 수동 | `apps/web/lib/queue.ts` `runManualCutover()` | 관리자 `POST /api/admin/cutover` |

### 이월이 하는 일 (그리고 하지 않는 일)

두 경로 모두 동일하게 이 네 가지만 수행합니다:

1. 새 주차를 `open`으로 생성 (`ensureWeek`) — 영구 장비 사용자의 주차×사용자
   용량/로딩 스냅샷(`weekly_queue_week_users`)을 시드
2. 이전 주차를 `closed`로 마킹
3. `weekly_schedule_settings.last_cutover_run_at` 갱신 + `audit_log` 기록
   (`auto_cutover` / `manual_cutover`)
4. `recomputeAllBacklogUsers(toWeekId)` — 백로그 전체를 새 주차 용량 기준으로
   FCFS 재스케줄 + 색상(green/yellow/orange) 갱신

> **미완료 신청을 주차 간에 강제 이동시키지 않습니다.** `status='pending'` 신청은
> 장비 사용자별 **단일 백로그**에 계속 쌓이며, `assigned_week_id`로 필터링되지
> 않고 항상 현재 활성 주차 용량 기준으로 스케줄됩니다. 큐에서 빠지는 유일한 방법은
> 웹앱의 "노광 완료" 처리(`completeSubmission`)입니다 —
> [backend.md](./backend.md) "노광 큐 = 누적 백로그 모델" 참고.
>
> 이 변경으로 `CutoverCheckResult`에서 `movedCount`가 사라졌고,
> `run-cutover-check.ts` 로그도 `rolled over <from> -> <to>`만 출력합니다.

### 코드 중복 주의

`packages/ingestion`은 `apps/web`에서 import할 수 없으므로, `cutover.ts`에
`ensureWeekUserSnapshot` / `ensureWeek` / `recomputeWeekUser` /
`recomputeAllBacklogUsers`가 `apps/web/lib/queue.ts`와 **의도적으로 중복**되어
있습니다. 백로그 스케줄링 규칙을 바꿀 때는 **두 파일을 함께** 수정해야 합니다.

`cutover.ts`는 주차 경계 판정에 타임스탬프 정확 일치가 아니라 "지금이 논리적으로
어느 주차인가"(`currentWeekId`)를 사용하므로, cron이 밀리거나 한 번 걸러도 다음
체크에서 정상 발화합니다. SQLite `datetime('now')`는 타임존 표기 없는 UTC라
`parseSqliteUtc()`로 명시 파싱합니다(KST 호스트에서 9시간 밀리던 버그 방지).

## 4. cron / systemd (배포 잡)

`deploy/cron/fab-dashboard-crontab.txt`:

| 스케줄 | 잡 |
|--------|-----|
| `0 */3 * * *` (3시간마다) | `run-update.ts` — 노트 변경 감지 + 추출 → `logs/ingestion.log` |
| `5 * * * *` (매시 05분) | `run-cutover-check.ts` — 주간 이월 경계 체크 → `logs/cutover.log` |

두 잡 모두 `cd /home/<username>/fab-dashboard` 후 `npx tsx`로 실행하며 `VAULT_PATH`/
`DB_PATH`를 인라인 지정합니다.

systemd `--user` 서비스 (`deploy/systemd/`):

| 서비스 | 명령 | 포트 | 로그 |
|--------|------|------|------|
| `fab-dashboard-web.service` | `npx next start -p 8001` (`apps/web`) | 8001 | `logs/web.log` |
| `fab-dashboard-gds.service` | `venv/bin/uvicorn app.main:app` | 8003 (내부) | `logs/gds-analyzer.log` |

nginx(`deploy/nginx/fab-dashboard.conf`)가 `fab.yourdomain.example`(HTTPS,
Let's Encrypt)를 `127.0.0.1:8001`로 프록시합니다. 배포 절차는
[deploy/README.md](../../deploy/README.md) 참고.

> systemd는 `Linger=no` 상태 — 계정 완전 로그아웃 시 서비스 종료. 재부팅/로그아웃
> 후에도 유지하려면 `sudo loginctl enable-linger <username>`.

## 관련 영역

- [integrations.md](./integrations.md) — Claude CLI 추출, GDS 사이드카
- [database.md](./database.md) — 인제스천/cutover가 채우는 테이블
- [backend.md](./backend.md) — `lib/queue.ts`, `api/admin/cutover`, `api/admin/ingestion`
