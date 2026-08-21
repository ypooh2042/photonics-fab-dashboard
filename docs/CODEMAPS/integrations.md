# Integrations 코드맵

**마지막 업데이트:** 2026-08-21

외부 서비스/프로세스 연동: (1) GDS 분석 FastAPI 사이드카, (2) Claude CLI 기반
LLM 랩노트 추출.

## 1. GDS 분석 사이드카 (`services/gds-analyzer`)

Python/FastAPI 서비스로, GDS 레이아웃 파일을 파싱해 레이어 면적/SVG 프리뷰를
계산하고 negative→positive 변환을 수행합니다. gdsfactory(+klayout)를 사용합니다.

### 진입점 / 구성

```
services/gds-analyzer/
├── app/main.py       FastAPI 앱, 엔드포인트 정의 + Pydantic 응답 모델
├── app/gds.py        analyze_layers_and_svg, convert_negative_to_positive
├── requirements.txt  fastapi 0.115, uvicorn 0.34, python-multipart, gdsfactory 9
├── run.sh            uvicorn app.main:app --host 127.0.0.1 --port 8003
└── venv/             전용 Python 3.12 venv (gitignore)
```

### 엔드포인트

| 메서드/경로 | 입력 | 출력 |
|-------------|------|------|
| `GET /health` | — | `{ ok: true }` |
| `POST /analyze` | UploadFile (.gds/.gds2/.oas) | `layers[]`, `svg`, `overall_bbox` |
| `POST /convert-positive` | file + `layers[]`(Form) + `isolation_gap_um`(Form) | `layers[]`, `svg`, `overall_bbox`, `grid_bounds`, `gds_base64` |

잘못된 파일은 400(HTTPException). klayout이 던지는 RuntimeError/Exception을
파싱/변환 실패 400으로 매핑합니다.

### 웹앱 연동

- 클라이언트: `apps/web/lib/gds-client.ts` — `analyzeGds(file)`, `convertToPositive(...)`.
- URL: `GDS_ANALYZER_URL` env (기본 `http://127.0.0.1:8003`), **내부 전용**(외부 미노출).
- 웹 라우트 `api/submissions/upload`, `api/layout-convert/*`가 이 클라이언트를 사용.
- 운영: systemd `fab-dashboard-gds.service` (`:8003`), 로그 `logs/gds-analyzer.log`.

```
브라우저 → api/submissions/upload (Next) → lib/gds-client.ts
        → http://127.0.0.1:8003/analyze (FastAPI) → gdsfactory/klayout
```

## 2. LLM 랩노트 추출 (Claude CLI)

`packages/ingestion`이 Obsidian 볼트의 랩노트를 읽어 Claude로 구조화 JSON을
추출합니다. **Anthropic API를 직접 호출하지 않고 `claude` CLI(`-p`)를 서브프로세스로
실행**합니다.

### 핵심 파일

| 파일 | 역할 |
|------|------|
| `src/extract.ts` | 시스템 프롬프트 조립 + `claude -p` 실행 + JSON 파싱 |
| `src/prompts/system-prompt.md` | 추출 지침 (시스템 프롬프트 본문) |
| `src/prompts/few-shot-examples.ts` | 볼트 실제 노트 기반 few-shot 예시 (gitignore — 로컬 전용) |
| `src/types.ts` | `NoteExtraction`, `StageType`, `RecipeCategory` 등 스키마 타입 |

### 측정값 전용 필드 규칙 (selectivity 파이프라인)

`system-prompt.md`에는 **`resist_thickness_nm`, `pre_strip_step_height_nm`,
`post_strip_step_height_nm` 세 필드에만 적용되는 강제 규칙**이 있습니다: 노트가
실제로 **측정된 숫자**(알파스텝/AFM 등)를 보고한 경우에만 그 키를 포함하고,
언급이 없거나 "측정 안함" 같은 서술만 있거나 범위/모호한 표현이면 **키를 아예
생략**합니다. 문자열(`"측정 안함"`, `"39~39.5nm"`)로 채우거나 값을 추측해 넣는 것은
금지입니다.

이유: 이 세 값이 `apps/web/lib/data.ts`의 `withDerivedSelectivity()`에 그대로
들어가 selectivity를 자동 계산하기 때문입니다. 키가 없으면 "미측정"으로 올바르게
해석되어 계산이 그냥 건너뛰어지지만, 잘못된/추측 숫자가 들어가면 존재하지 않아야 할
selectivity 포인트가 조용히 트렌드 차트에 찍힙니다.

### 인증 동작 (주의)

`extract.ts`의 `subprocessEnv()`는 `ANTHROPIC_API_KEY`/`ANTHROPIC_AUTH_TOKEN`/
`ANTHROPIC_PROFILE`를 서브프로세스 환경에서 **제거**합니다. 이렇게 해서 `claude`가
프로세스에 우연히 설정된 (자금이 없을 수 있는) API 키 대신 자체 저장된
OAuth/구독 로그인(`~/.claude/.credentials.json`)으로 폴백하게 합니다.

> `.env.example`에 `ANTHROPIC_API_KEY`가 있지만, 실제 추출 경로는 CLI 로그인에
> 의존합니다. 서버에서 `claude`가 로그인된 상태여야 인제스천이 동작합니다.

### 데이터 흐름

```
Obsidian Vault (.md)  ─ VAULT_PATH env
   │  scan-notes.ts (mtime/sha256로 변경 감지)
   ▼
extractNote({ noteContent, knownProjects, knownChipRuns, knownRecipes })
   │  claude -p  (system-prompt.md + few-shot)
   ▼
NoteExtraction JSON  ─ upsert.ts → SQLite (chip_runs, stages, recipe_entries, photos)
```

파이프라인 실행/스케줄 상세는 [workers.md](./workers.md) 참고.

## 관련 영역

- [workers.md](./workers.md) — 인제스천 실행 시점/방식
- [backend.md](./backend.md) — `gds-client.ts`, `api/admin/ingestion`
- [database.md](./database.md) — 추출 결과가 채우는 테이블
