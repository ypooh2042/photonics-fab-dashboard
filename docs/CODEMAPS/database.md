# Database 코드맵

**마지막 업데이트:** 2026-08-21
**스키마 파일:** `db/schema.sql` (수동 관리, 마이그레이션 도구 없음)
**DB 파일:** `data/fab_dashboard.sqlite` (better-sqlite3, WAL, gitignore)

단일 SQLite 파일입니다. `PRAGMA journal_mode = WAL`, `PRAGMA foreign_keys = ON`.
초기화: `scripts/init-db.sh` (`sqlite3 data/fab_dashboard.sqlite < db/schema.sql`).
스키마 변경은 `db/schema.sql`을 직접 수정하고 재적용/수동 ALTER로 관리합니다
(자동 마이그레이션 없음).

## 접근 경로

- 웹앱: `apps/web/lib/db.ts` `getDb()` — `DB_PATH` env(기본 `../../data/fab_dashboard.sqlite`).
- 인제스천: `packages/ingestion/src/db.ts` `getDb()` — 같은 파일을 가리킴.
- 둘 다 동기 better-sqlite3 싱글턴. 같은 파일에 동시 접근하므로 WAL 사용.

## 테이블 그룹

### 프로젝트 / 칩 진행 상황

| 테이블 | 목적 | 핵심 관계 |
|--------|------|-----------|
| `projects` | 연구 프로젝트 (slug, vault_folder, 현황 파일 경로) | — |
| `chip_runs` | 물리적 칩 런 1개 단위 (aliases, status, LLM confidence, needs_review) | → `projects` |
| `pipeline_stage_instances` | 칩 런의 공정 스테이지 (stage_type, status, seq/sort_order) | → `chip_runs` (CASCADE), → `recipe_entries` |
| `photos` | 사진 메타 (AUTOINCREMENT id, resolved_path, source_path) | — |
| `chip_run_photos` | 칩 런/스테이지에 붙는 사진 조인 | → `chip_runs`(CASCADE), `pipeline_stage_instances`(SET NULL), `photos` |
| `photo_index_conflicts` | 파일명 중복 후보 경로 추적 | — |

> `photos.id`는 **AUTOINCREMENT (재사용 금지)**. `/api/photos/[id]`가 24h 브라우저
> 캐시를 이 id로 키잉하므로 id 재사용 시 다른 사진의 stale 이미지가 서빙됩니다.
> `resolved_path`는 항상 앱 자체 복사본(`data/admin-photo-uploads`)을 가리켜
> 유지보수 삭제가 볼트 원본을 건드리지 않습니다.

### 레시피 위키

| 테이블 | 목적 |
|--------|------|
| `recipe_categories` | 공정 카테고리 + `param_schema`(JSON) — 시드 7종 |
| `recipe_entries` | 칩 런별 레시피 기록 (params JSON, is_standard_condition, LLM confidence) |
| `recipe_definitions` | 레시피의 고정 스텝 설명 + `entry_mode`(`full`/`log_only`) |
| `recipe_events` | 트렌드 차트용 관리자 이벤트 마커 (event_date, label) → `recipe_categories` |

> `entry_mode='log_only'`: 모든 내용이 `description`에 있고, 엔트리는 entry_date만
> 기록 (params 추출 안 함). `'full'`(기본): 엔트리가 LLM 추출 per-run params를 가짐.

> `recipe_events`는 **(category_id, recipe_name) 개별 쌍**에 스코프됩니다
> (카테고리 단위가 아님) — 같은 카테고리라도 레시피마다 다른 물리 장비를 쓸 수
> 있기 때문. 인덱스 `idx_recipe_events_recipe(category_id, recipe_name, event_date)`.
> 트렌드 차트를 그리는 카테고리(`etching`, `deposition`)에서만 편집/렌더됩니다.
> 이 테이블은 스키마에 마이그레이션 도구가 없어 `db/schema.sql` 반영 + 라이브
> DB에 수동 `CREATE TABLE`로 적용했습니다 (이 프로젝트의 수동 ALTER 규약).

시드 카테고리: `cleaning_coating`, `lithography`, `photolithography`,
`development`, `etching`, `deposition`, `other`.

### 인제스천 상태

| 테이블 | 목적 |
|--------|------|
| `note_ingestion_state` | 노트별 mtime/sha256/처리상태/연속실패/원본 LLM 응답 (PK: note_path) |

### 노광 큐 / 스케줄링

| 테이블 | 목적 |
|--------|------|
| `equipment_users` | 장비 사용자 (alias, is_permanent, capacity_hours, loading_cost_minutes) |
| `layout_submissions` | GDS 노광 신청 (레이어 면적, 도즈 범위, 노광 시간, 배정 주차, 색상, `status`, `completed_at`) |
| `weekly_schedule_settings` | 단일 행(id=1) 전역 설정 (용량, cutover 시각, 도즈/드웰 파라미터) |
| `weekly_queue_weeks` | 주차 (week_id, 용량 스냅샷, status `open`/`closed`) |
| `weekly_queue_week_users` | 주차×사용자 용량/로딩 스냅샷 (FCFS를 사용자별 독립 실행) |
| `resist_reference_doses` | 레지스트별 기준 도즈 (시드: ZEP520A 240) |
| `ebeam_currents` | e-beam 전류 프리셋 (시드: 2nA KANC 표준) |

> `weekly_schedule_settings.loading_cost_minutes`는 이제 스케줄링에 직접 쓰이지
> 않고, 새 장비 사용자 생성 시 `equipment_users.loading_cost_minutes` 시드값으로만
> 사용됩니다. 실제 스케줄링은 사용자별 값을 사용합니다.

> **`layout_submissions.status` / `assigned_week_id` 의미 (중요):** status는
> `'pending' | 'completed'` 두 값만 씁니다.
> - `pending` 행은 **주차로 분할되지 않는 누적 백로그**입니다. `assigned_week_id`는
>   처음 신청된 주차로 남아 있지만 스케줄링/조회에서 필터로 쓰이지 **않으며**,
>   FCFS는 항상 현재 활성 주차의 `weekly_queue_week_users` 스냅샷 기준으로 돕니다.
>   주간 이월(cutover)은 이 행들을 다른 주차로 옮기지 않습니다.
> - `completed` 행은 `completeSubmission`이 기록한 노광 완료 이력입니다. 이때
>   `assigned_week_id`가 **실제 노광이 돌아간 주차로 재배정**되고 `completed_at`이
>   찍힙니다. 즉 완료 행의 `assigned_week_id`는 "신청 주차"가 아니라 "노광 주차"입니다.
>   과거 주차 큐 조회는 이 완료 행만 읽습니다 ([backend.md](./backend.md) 참고).
>
> `completed_at TEXT`는 마이그레이션 도구가 없으므로 `db/schema.sql` 반영 + 라이브
> DB에 수동 `ALTER TABLE`로 적용합니다 (이 프로젝트의 수동 ALTER 규약).

### e-beam Mock 칩 배치 에디터

| 테이블 | 목적 |
|--------|------|
| `chip_layout_jobs` | 사용자×주차 배치 잡 (cassette_type piece1/piece2) |
| `chip_layout_chips` | 윈도우(A/B/D) 내 물리적 칩 배경 블록 (width/center_x) |
| `chip_layout_exposure_jobs` | 배치 내 노광 잡 (current/dose/scan_step/window_key) |
| `chip_layout_pattern_slots` | 배치 내 패턴 슬롯 문자(a/b/c…) — 앱 코드가 유일/연속 관리 |
| `chip_layout_placement_instances` | 노광 잡 내 패턴 배치 (pattern_key, center_x/y) |
| `chip_layout_pattern_snapshots` | **닫힌 주차** 배치의 얼린 패턴 후보 목록 (UNIQUE(batch_id, pattern_key)) |

> `chip_layout_jobs.week_id`가 주차에 스코프됩니다. 이월(cutover) 시 배치는
> 이월되지 않고 히스토리로 누적만 되며, 에디터는 기본적으로 현재 주차 행만
> 나열하므로 새 주차는 빈 목록으로 시작합니다. `listJobs(equipmentUserId, weekId?)`에
> 과거 주차를 명시하면 그 주차 배치를 **읽기 전용**으로 조회하며, 이 경우 결과가
> 비어도 "Batch1"을 자동 생성하지 않습니다(히스토리 조작 방지).
>
> `pattern_key`는 저장된 FK가 아니라 그 배치의 주차 큐에서 결정적으로 생성되는
> 문자열입니다 (`lib/chip-layout.ts` `computeRawCandidates` — 전역 활성 주차가 아니라
> **배치 자신의 `week_id`** 기준, `status IN ('pending','completed')` 신청 전부가
> 패턴 소스). 같은 패턴을 같은 노광 잡에 여러 번 배치할 수 있어 uniqueness 제약이
> 없습니다.
>
> **`chip_layout_pattern_snapshots` (insert-only):** 배치의 주차가 `closed`가 된 뒤
> 그 배치의 패턴을 처음 읽는 시점에, 그때의 후보 목록(patternKey, slot_index,
> label, size, area, svg 경로, grid 경계, layer/datatype)을 통째로 얼려 저장합니다
> (`getOrCreateFrozenPatternSnapshot`). 이후 그 주차 `layout_submissions`가 바뀌어도
> (예: 뒤늦은 노광 완료 기록) 과거 배치 뷰가 흔들리지 않습니다. **읽기가 이 테이블이나
> `chip_layout_placement_instances`를 삭제하는 경로는 없습니다** — 과거에 읽기 중
> prune이 실제 배치 행을 조용히 지운 버그가 있었기 때문입니다. 유일한 삭제 지점은
> `refreshPatternSnapshotForUserWeek`(완료 기록이 닫힌 주차에 들어올 때 재동결)와
> 명시적 `pruneOrphanedPlacementsForUserWeek`(현재 `deleteSubmission`에서만 호출)입니다.
> 상세는 [backend.md](./backend.md) "패턴 스냅샷 · orphan prune 규칙" 참고.

### 감사

| 테이블 | 목적 |
|--------|------|
| `audit_log` | actor/action/entity/before_json/after_json 변경 이력 |

## 관계 다이어그램 (핵심)

```
projects ─< chip_runs ─< pipeline_stage_instances >─ recipe_entries >─ recipe_categories ─< recipe_events
                │                                          │
                └─< chip_run_photos >─ photos              └─ recipe_definitions

equipment_users ─< layout_submissions >─ weekly_queue_weeks ─< weekly_queue_week_users
       │            (pending=백로그 / completed=노광 주차)  │
       └─< chip_layout_jobs ──────────────< (week_id) ┘
                  ├─< chip_layout_chips
                  ├─< chip_layout_exposure_jobs ─< chip_layout_placement_instances
                  ├─< chip_layout_pattern_slots
                  └─< chip_layout_pattern_snapshots   (주차 closed 시 동결)
```

## 시드 데이터 (schema.sql 하단)

- `weekly_schedule_settings` id=1 (용량 2.0h, cutover 수요일 08:00 Asia/Seoul).
- 레시피 카테고리 7종, `resist_reference_doses` ZEP520A, `ebeam_currents` 2nA.
- `equipment_users` 4명 (예시 부트스트랩 값 — user1/user2 permanent 1.0h, user3/user4 0h).
- `projects` 4개 (예시 부트스트랩 값 — project-a/b/c/d).

## 관련 영역

- [backend.md](./backend.md) — 테이블을 읽고 쓰는 lib/API
- [workers.md](./workers.md) — 인제스천/cutover가 채우는 테이블
