# Workers 코드맵 (인제스천 · 스케줄링 · 배포 잡)

**마지막 업데이트:** 2026-08-07
**진입점:** `packages/ingestion/src/run-update.ts`, `run-cutover-check.ts`,
`backfill.ts`; `packages/scheduling/src/*`

백그라운드 처리: (1) 랩노트 인제스천 파이프라인, (2) 주간 노광 큐 이월(cutover),
(3) 순수 스케줄링 라이브러리. cron으로 주기 실행됩니다.

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
| `run-cutover-check.ts` | 주간 경계 통과 여부 확인 → cutover 실행 |
| `cutover.ts` | `checkAndRunCutover()` — 주간 큐 스케줄 확정 (scheduling 사용) |
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

## 3. cron / systemd (배포 잡)

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
