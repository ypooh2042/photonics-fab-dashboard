# fab-dashboard

포토닉스 반도체 공정(fab) 진행 상황 · 레시피 위키 · e-beam 노광 큐/레이아웃을
관리하는 내부 대시보드입니다. Obsidian 볼트의 랩노트를 LLM으로 추출해 SQLite에
채우고, Next.js 대시보드로 조회/편집합니다.

- 운영 URL: https://fab.yourdomain.example (nginx + Let's Encrypt, 내부용)
- 저장소: https://github.com/ypooh2042/photonics-fab-dashboard

## 코드맵 (먼저 읽기)

구조를 빠르게 파악하려면 [docs/CODEMAPS/INDEX.md](docs/CODEMAPS/INDEX.md)부터 보세요.

| 코드맵 | 범위 |
|--------|------|
| [frontend](docs/CODEMAPS/frontend.md) | `apps/web` 페이지/컴포넌트/네비게이션 |
| [backend](docs/CODEMAPS/backend.md) | API 라우트, `lib` 도메인 로직, 인증 |
| [database](docs/CODEMAPS/database.md) | `db/schema.sql` 테이블/관계/시드 |
| [integrations](docs/CODEMAPS/integrations.md) | GDS 사이드카, Claude CLI 추출 |
| [workers](docs/CODEMAPS/workers.md) | 인제스천, cutover, cron/systemd |

> **Next.js 16 주의:** 이 프로젝트의 Next.js 버전은 학습 데이터와 다른 API/규약이
> 있습니다. 웹앱 코드를 작성하기 전에 [apps/web/AGENTS.md](apps/web/AGENTS.md)와
> `node_modules/next/dist/docs/`를 확인하세요. 특히 인증 미들웨어는
> `middleware.ts`가 아니라 `apps/web/proxy.ts`이고, export 함수도 `middleware`가
> 아니라 `proxy`입니다.

## 모노레포 구성

```
apps/web/               Next.js 16 App Router 대시보드 (메인 앱)
packages/ingestion/     Obsidian 랩노트 → SQLite 인제스천 (Claude CLI 추출)
packages/scheduling/    FCFS 노광 큐 스케줄링 라이브러리 (+ vitest 테스트)
services/gds-analyzer/  Python/FastAPI GDS 분석 사이드카 (독립 venv)
db/schema.sql           SQLite 스키마 (수동 관리, 마이그레이션 도구 없음)
deploy/                 nginx / systemd / cron 설정
scripts/                init-db.sh, hash-password.ts
```

npm workspaces: `apps/web`, `packages/*`. `services/gds-analyzer`는 별도 Python
프로세스로 실행됩니다.

## 기술 스택

- Next.js 16.2.11 · React 19.2.4 · TypeScript 5 · Tailwind CSS 4
- better-sqlite3 11 (동기) · 단일 파일 `data/fab_dashboard.sqlite` (WAL)
- 인증: JWT (`jose`) + bcrypt, 역할 `admin`/`viewer` (+ operator 2차 게이트)
- 인제스천: `tsx` 실행 TS 스크립트, `claude -p` CLI로 LLM 추출
- GDS: Python 3.12 · FastAPI · uvicorn · gdsfactory 9

## 시작하기

### 1. 의존성 설치

```bash
npm install                      # 루트에서 (workspaces 전체)
```

GDS 사이드카(Python)는 별도로 venv를 구성합니다:

```bash
cd services/gds-analyzer
python3 -m venv venv
venv/bin/pip install -r requirements.txt
```

### 2. 환경변수

루트 `.env.example`를 복사해 값을 채웁니다 (웹앱은 `apps/web/.env.local`, 인제스천은
루트 `.env` 또는 cron 인라인 env를 사용):

```bash
cp .env.example apps/web/.env.local
```

| 변수 | 용도 |
|------|------|
| `ANTHROPIC_API_KEY` | (참고용) — 실제 추출은 `claude` CLI 로그인 사용 |
| `VAULT_PATH` | Obsidian 볼트 경로 (인제스천) |
| `DB_PATH` | SQLite 파일 경로 (기본 `./data/fab_dashboard.sqlite`) |
| `VIEWER_PASSWORD_HASH` / `ADMIN_PASSWORD_HASH` | bcrypt 로그인 해시 |
| `OPERATOR_PASSWORD_HASH` | LLM 추출 서브섹션 2차 잠금 해시 |
| `SESSION_SECRET` | JWT 서명 시크릿 |
| `GDS_ANALYZER_URL` | GDS 사이드카 URL (기본 `http://127.0.0.1:8003`) |
| `PORT` | 웹앱 포트 (기본 8001) |
| `COOKIE_SECURE` | HTTPS 배포 시 `true` (LAN 평문 HTTP는 `false`) |

비밀번호 해시 생성:

```bash
npx tsx scripts/hash-password.ts '<새 비밀번호>'
```

> `.env.local`에 해시를 넣을 때 **`$` 문자를 전부 `\$`로 escape**하세요. Next.js가
> `.env` 파일의 `$VAR`를 변수 참조로 해석해, 놓치면 로그인이 조용히 실패합니다.

### 3. DB 초기화

```bash
./scripts/init-db.sh             # sqlite3 data/fab_dashboard.sqlite < db/schema.sql
```

### 4. 개발 서버

```bash
npm run dev                      # apps/web 개발 서버
# GDS 사이드카 (별도 터미널)
cd services/gds-analyzer && ./run.sh   # 127.0.0.1:8003
```

## npm 스크립트 (루트)

| 스크립트 | 동작 |
|----------|------|
| `npm run dev` | 웹앱 개발 서버 |
| `npm run build` | 웹앱 프로덕션 빌드 |
| `npm run ingest:update` | 변경 노트 증분 추출 (cron 3h가 사용) |
| `npm run ingest:cutover` | 주간 큐 이월 경계 체크 (cron 1h가 사용) |
| `npm run ingest:backfill` | 과거 노트 일괄 처리 |
| `npm run ingest:dry-run` | 쓰기 없이 추출 미리보기 |
| `npm run test:scheduling` | `packages/scheduling` vitest 테스트 |

## 배포 / 운영

- systemd `--user` 서비스: `fab-dashboard-web.service`(:8001),
  `fab-dashboard-gds.service`(:8003 내부).
- nginx + Let's Encrypt로 `fab.yourdomain.example` 프록시.
- cron: 3시간마다 인제스천, 매시 이월 체크.
- 로그: `logs/web.log`, `logs/gds-analyzer.log`, `logs/ingestion.log`, `logs/cutover.log`.

전체 절차/체크리스트는 [deploy/README.md](deploy/README.md) 참고.

## 테스트

현재 자동화 테스트는 `packages/scheduling`(vitest)에만 존재합니다. `apps/web`,
`packages/ingestion`에는 테스트가 아직 없습니다.

```bash
npm run test:scheduling
```

## 관련 문서

- [docs/CODEMAPS/](docs/CODEMAPS/) — 아키텍처 코드맵
- [apps/web/README.md](apps/web/README.md) — 웹앱 상세
- [apps/web/AGENTS.md](apps/web/AGENTS.md) — Next.js 버전 경고 (필독)
- [deploy/README.md](deploy/README.md) — 배포 체크리스트
