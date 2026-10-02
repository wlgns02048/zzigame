# 서버 버전 (NAS) 배포

## 버전 관리

| 브랜치 / 태그 | 내용 | 서비스 |
|---|---|---|
| `main` | 정적 게임 (로컬 저장만) | GitHub Pages — `icecrown-trial.duckdns.org` |
| `v1.0.0` 태그 | 서버 작업 시작 전 main 스냅샷 | — |
| `server` | 계정 · 세이브 동기화 · 건의사항 게시판 | NAS Docker (포트 13100) |

`server`에서 개발하고, 충분히 검증되면 main에 합치고 도메인을 NAS로 옮긴다.
게임 쪽 수정(밸런스 등)은 main에 먼저 하고 `git merge main`으로 server에 가져오면 된다.

> 주의: `Z:\docker\zzigame`은 RaiDrive로 연결된 NAS 폴더 그 자체라서, 로컬에서 `git checkout main`을 하면
> NAS 쪽 파일도 main으로 바뀐다. NAS 컨테이너를 다시 빌드할 때는 반드시 `server` 브랜치가 체크아웃된 상태여야 한다.

## 구조

- `server/server.js` — Node 22 내장 모듈만 사용 (npm 패키지 없음, DB는 `node:sqlite`)
  - 정적 파일(`index.html`, `css/`, `js/`, `assets/`) + `/api/*`
  - 데이터: `data/game.db`
- 재화와 특성은 **서버만 바꾼다**. 브라우저는 결과를 받아 보여줄 뿐
  - 특성 구매: `POST /api/talents/buy` — 비용 계산과 골드 차감을 서버에서
  - 판 보상: `POST /api/runs/start` → `POST /api/runs/report`(누적값). 서버가 실제 경과 시간 · 처치/골드 상한으로
    검증하고 이전 지급분과의 차액만 지급. 거부된 판은 서버 로그에 `run rejected ... reasons=` 로 남는다
  - 특성 정의(`js/data/talents.js`)는 서버와 브라우저가 같은 파일을 쓴다
- 저장 방식: 로그인 = 서버 / 서버는 있는데 게스트 = 저장 안 함 / 서버 없음(정적 호스팅) = 브라우저 저장
- 직업별 로직은 `js/classes/<직업>.js` 훅으로 분리 (`G.cls(p).훅`)

## 밸런스 시뮬레이터

```sh
node tools/sim.cjs                    # 8판, 고정 시드
node tools/sim.cjs --runs 16 --secs 600 --query "&all=1"
```

서버를 임시 포트 · 임시 DB로 직접 띄우고 봇으로 여러 판을 돌려 표로 출력한다. 시드가 고정이라
코드가 같으면 결과도 같으므로, 수치를 바꾸기 전후로 돌려 비교한다. Playwright가 필요하다.

## 환경 변수

| 이름 | 기본값 | 설명 |
|---|---|---|
| `PORT` | 8080 (NAS 13100) | 서버 포트 |
| `ADMIN_USERS` | (없음) | 게시판 관리자 아이디, 쉼표 구분. 관리자는 글 상태 변경/삭제 가능 |

NAS의 프로젝트 폴더에 `.env`를 만들어 `ADMIN_USERS=원하는아이디` 를 넣는다 (커밋되지 않음).

## 배포

`server` 브랜치에 push하면 `.github/workflows/deploy.yml`이 SSH로 NAS에서 아래를 실행한다.

```sh
docker compose -f docker-compose.yml -f docker-compose.nas.yml up --build -d
```

필요한 GitHub Secrets (zziraidbot과 동일한 이름): `NAS_HOST`, `NAS_USER`, `NAS_SSH_KEY`, `NAS_PORT`,
`NAS_PROJECT_PATH`(예: `/volume2/docker/zzigame`).

## 외부 접속

1. DuckDNS에서 새 서브도메인(예: `icecrown-beta`)을 만들어 집 IP를 가리키게 한다.
   기존 `icecrown-trial`은 GitHub Pages(main)용이므로 건드리지 않는다.
2. DSM → 로그인 포털 → 고급 → 리버스 프록시: `https://<새 도메인>:443` → `http://localhost:13100`
3. DSM → 보안 → 인증서에서 해당 도메인 Let's Encrypt 인증서 발급 후 리버스 프록시에 할당

## 로컬 실행

```sh
DATA_DIR=C:/temp/zzigame-data PORT=8080 node server/server.js   # http://localhost:8080
```

DB 파일을 `Z:` 아래에 두지 말 것 (RaiDrive 문제, `../DOCKER_VOLUMES.md`).

## 백업

`data/game.db`(+ `-wal`, `-shm`)를 복사하면 된다. 컨테이너를 멈추고 복사하는 것이 가장 안전하다.
