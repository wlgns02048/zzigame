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
  - 데이터: `data/game.db` (users, sessions, suggestions, votes)
- 클라이언트: `js/net.js`. 서버가 없으면(GitHub Pages 등) 자동으로 게스트 전용 모드로 동작
- 게스트 진행도는 브라우저 localStorage, 로그인하면 계정(서버)에 저장. 가입 시 게스트 진행도를 계정으로 가져감

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
