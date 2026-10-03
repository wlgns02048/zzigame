# 서버 버전 (NAS) 배포

## 버전 관리

| 브랜치 / 태그 | 내용 | 서비스 |
|---|---|---|
| `server` | 현재 서비스 버전 (베타) — 계정 · 스테이지 · 흑마법사 · 장비 · 가챠 · 랭킹 · 퀘스트 · 금고 | NAS Docker → `https://Godlovesyou.synology.me:10443` |
| `v2.7.1` 태그 | 클리어 후 "보상 받고 종료"가 최종 보고를 보내지 않아 출정(3판 플레이) 퀘스트에 안 세어지던 버그 수정 · 일일/주간 퀘스트 보상 상향(판 1회 보상 이상) · 스컬지 소탕 목표 2,000 → 10,000마리 | — |
| `v2.7.0` 태그 | 건의 반영: 스테이지 단계 · 난이도별 골드 배율(폐광 1배 ~ 낙스라마스 2.5배, 영웅 1.5배 — 줍는 골드 · 시간 · 클리어 보너스 모두) · 출정 화면에 보상 배율 표시 · 부패의 씨앗이 걸린 적 표시(머리 위 아이콘 · 남은 시간 · 발밑 고리) · 아이템 툴팁이 칸 안에서 깜빡이며 사라지던 문제 수정 · 자석이 경험치뿐 아니라 골드 · 음식 · 상자 등 바닥의 모든 전리품을 끌어옴 · 새 전리품 피의 욕망(드묾, 40초 동안 게임 전체 속도 1.5배 — 서버 시계 검증에 반영) | — |
| `v2.6.0` 태그 | 던전별 배경음악: WebAudio 실시간 합성(음원 파일 없음) · 던전마다 음계 · 악기 · 리듬 테마 · 보스전에 북 · 템포 상승 · N 키로 배경음악 켜기/끄기 | — |
| `v2.5.0` 태그 | 바닥 기술 개편: 플레이어 이동을 앞질러 겨냥(원 카이팅은 호를 따라 예측) · 보스 장판 패턴 일렬 · 포위 · 추적 추가 · 장판 피해 하향 · 새 버전 자동 적용(화면 전환 때 새로고침) | — |
| `v2.4.0` 태그 | 채팅 개선: 게스트도 채팅(`게스트1234` 같은 임의 번호 이름) · 왼쪽 아래로 이동 · 출정 중에도 채팅(Enter 입력 · Esc 취소) · 보스 머리 위 이름표 | — |
| `v2.3.0` 태그 | 접속자 목록 · 채팅 (로비 오른쪽 아래) | — |
| `v2.2.0` 태그 | 건의 반영: 고통 흑마 조정 · 중간급 몬스터 바닥 기술 · 정예 표시 · 주문 도감 · 강화 접두어 완화 | — |
| `v2.1.1` 태그 | 액션바 자동 시전 표시 버그 수정 | — |
| `v2.1.0` 태그 | 밸런스 개편 (기본 주문 하향 · 자동 시전 · 고통 흑마법사 주문 정리) | — |
| `v2.0.0` 태그 | 첫 베타 (계정 · 스테이지 · 흑마법사 · 장비 · 가챠 · 랭킹 · 퀘스트 · 금고) | — |
| `v1.0.0` 태그 | 서버 작업 시작 전 원래 게임 | 공개 주소의 `/classic/` |
| `main` | (더 이상 배포에 쓰지 않음) 입구 페이지 + classic 사본 | — |

**공개 주소 `https://icecrown-trial.duckdns.org`** = GitHub Pages. `server`에 push할 때마다 `.github/workflows/pages.yml`이
루트에 베타 화면, `/classic/`에 v1.0.0 원래 게임을 올린다 (Pages 설정: 원본 = GitHub Actions, `github-pages` 환경에 `server` 브랜치 허용).
Pages는 서버를 돌릴 수 없으므로 공개 주소에서 열린 화면은 로그인 · 저장 · 랭킹 등 API를 나스 베타 서버
(`https://Godlovesyou.synology.me:10443`)로 보낸다 — `js/net.js`의 `base`, 서버는 그 출처만 CORS 허용(`CORS_ORIGINS`).
두 주소 어디로 들어와도 같은 계정 · 같은 DB를 쓴다.

- 버전 표기는 `주.부.패치` (SemVer를 게임에 맞게 쓰는 와우식). 배포할 때마다 셋 중 하나를 올리고, 오른쪽 자리는 0으로:
  - **주(Major)** — 게임 구조가 바뀌는 대형 업데이트: 새 직업 · 새 챕터(확장팩) · 경제/계정 구조 변경 → `3.0.0`
  - **부(Minor)** — 콘텐츠 · 기능 · 밸런스 개편: 새 스테이지 · 새 시스템 · 주문 대량 조정 → `2.2.0`
  - **패치(Patch)** — 버그 수정 · 작은 수치 조정 → `2.1.2`
- '베타'는 버전 번호에 붙이지 않고 서비스 상태로만 표시한다 (로비 BETA 배지, GitHub 릴리스 제목). 예전 `v2.0.0-beta.1` · `-beta.2` 태그는
  기록으로 남겨 두었고 각각 `v2.0.0` · `v2.1.0`과 같은 커밋이다
- 화면 표시 버전은 `js/util.js`의 `G.VERSION` — 버전을 올릴 때 태그(`vX.Y.Z`) · GitHub 릴리스와 같이 올린다
- 접속 중인 화면은 1분마다 서버의 `G.VERSION`을 확인해서, 바뀌었으면 판이 끝난 뒤 화면이 바뀔 때(로비 탭 이동 · 로비 복귀 · 출정) 스스로 새로고침한다 (`js/update.js`).
  **버전을 올리지 않은 배포는 감지되지 않는다** — 화면에 영향이 있는 배포는 패치 자리라도 올릴 것
- 되돌리기(원래 게임을 다시 루트로): Pages 설정 원본을 "Deploy from a branch → main"으로 바꾸고 main을 v1.0.0 내용으로

> `Z:\docker\zzigame`은 RaiDrive로 연결된 NAS 폴더 그 자체다. 배포는 러너가 push된 커밋을 따로 받아서 하므로
> 로컬에서 어느 브랜치를 체크아웃해도 서비스에는 영향이 없다. main을 고칠 때는 `git worktree`로 다른 폴더에서 작업하는 것을 권장.

## 구조

- `server/server.js` — HTTP · 정적 파일 · 인증 · 건의사항. Node 22 내장 모듈만 사용 (npm 패키지 없음, DB는 `node:sqlite`)
- `server/db.js` — 스키마 (기존 DB에는 없는 열을 자동 추가)
- `server/game.js` — 게임 경제 API. 데이터: `data/game.db`
- 재화 · 아이템 · 특성은 **서버만 바꾼다**. 브라우저는 결과(`profile`)를 받아 보여줄 뿐
- 정의 데이터는 서버와 브라우저가 같은 파일을 쓴다: `js/data/talents.js` · `items.js` · `stages.js`
- 직업별 로직은 `js/classes/<직업>.js` 훅으로 분리 (`G.cls(p).훅`)
- 게스트(로그인 안 함)는 죽음의 폐광 · 얼음왕관만 플레이, 아무것도 저장되지 않음

### API

| 경로 | 설명 |
|---|---|
| `POST /api/auth/register` · `login` · `logout` | 계정 (가입 시 냉기 마법사 캐릭터 생성) |
| `GET /api/me` | 프로필: 지갑 · 캐릭터 · 특성 · 아이템 · 소모품 · 진행 · 가챠 천장 · 퀘스트 · 금고 · 이번 주 접두어 |
| `POST /api/characters` | 직업 캐릭터 생성 |
| `POST /api/talents/point` · `set` · `reset` | 특성 포인트 구매(골드) · 배분(내리기 불가) · 초기화(골드) |
| `POST /api/items/equip` · `unequip` · `lock` · `sell` · `disenchant` · `socket` · `enchant` | 장비 |
| `POST /api/gacha` | `{ kind: equip/enchant/gem, count: 1/10, premium }` |
| `POST /api/runs/start` → `POST /api/runs/report` | 판 시작(개방 여부 검사) → 누적값 보고. 실제 경과 시간 · 처치/골드 상한 · 보스 수로 검증하고 이전 지급분과의 차액만 지급. 거부된 판은 서버 로그에 `run rejected ... reasons=` |
| `GET /api/rankings` | `stage · difficulty · kind(clear/endless) · scope(week/all) · cls` |
| `POST /api/quests/claim` · `POST /api/vault/claim` | 퀘스트 보상 · 금고 선택 |
| `GET/POST/PATCH/DELETE /api/suggestions…` | 건의사항 게시판 |

## 도구

```sh
node tools/sim.cjs                    # 밸런스 시뮬레이터: 8판, 고정 시드
node tools/sim.cjs --runs 16 --secs 700 --query "&stage=scholomance&cls=warlock&gear=40&talents=1"
python tools/fetch_icons.py           # 아이콘 받기 (wow.zamimg.com, 이미 있는 파일은 건너뜀)
```

시뮬레이터는 서버를 임시 포트 · 임시 DB로 직접 띄우고 봇으로 여러 판을 돌려 표로 출력한다. 시드가 고정이라
코드가 같으면 결과도 같으므로, 수치를 바꾸기 전후로 돌려 비교한다. `gear`(가상 영웅 풀세트 아이템 레벨) ·
`talents`(직업 특성 31점)는 시뮬레이션 전용이고 서버에는 저장되지 않는다. Playwright가 필요하다.

> 테스트 전용 환경 변수 `ZZ_SKIP_CLOCK=1`은 런 보고의 실제 경과 시간 검증을 끈다. **운영에서는 절대 설정하지 말 것.**

> Z:(RaiDrive) 위의 파일을 스크립트로 통째로 다시 쓰면 드물게 4KB 단위로 잘리는 일이 있었다 (2026-10, `server/game.js` · `js/game.js`).
> 큰 파일을 고친 뒤에는 크기와 `node --check`로 확인하고, 커밋 전에 빈 파일이 없는지 본다.

## 환경 변수

| 이름 | 기본값 | 설명 |
|---|---|---|
| `PORT` | 8080 (NAS 13100) | 서버 포트 |
| `ADMIN_USERS` | (없음) | 게시판 관리자 아이디, 쉼표 구분. 관리자는 글 상태 변경/삭제 가능 |

NAS의 프로젝트 폴더에 `.env`를 만들어 `ADMIN_USERS=원하는아이디` 를 넣는다 (커밋되지 않음).

## 배포

`server` 브랜치에 push하면 `.github/workflows/deploy.yml`이 **나스의 셀프호스티드 러너**에서 실행된다
(qdrop과 같은 방식, SSH 비밀값 불필요). 러너는 push된 커밋을 자기 작업 폴더에 받아 아래를 실행한다.

```sh
DATA_ROOT=/volume2/docker/zzigame-data docker compose -p zzigame -f docker-compose.yml -f docker-compose.nas.yml up --build -d
```

- 로컬 `Z:\docker\zzigame`이 어느 브랜치든 상관없이 **push한 커밋**이 배포된다
- DB는 러너 작업 폴더 밖 `/volume2/docker/zzigame-data/game.db` (체크아웃 때 작업 폴더가 정리되므로)
- 게시판 관리자: 저장소 Settings → Secrets and variables → Actions → **Variables**에 `ADMIN_USERS`
- 수동 배포: Actions 탭 → Deploy to NAS → Run workflow
- **나스는 서버가 쓰는 파일이 바뀔 때만 다시 배포된다** (`server/`, `js/data/`, `Dockerfile`, compose 파일, `deploy.yml`).
  화면만 바뀐 커밋은 Pages만 갱신 — 나스 주소(10443)에서 직접 여는 화면까지 맞추려면 수동 배포
- 게임 중 배포해도 괜찮게: 재시작 중(연결 실패 · 502~504)이면 화면이 판 시작은 15초, 판 결과 보고는 60초까지 다시 시도한다
  (`js/net.js` `apiRetry`). 보고는 누적값이라 다시 보내도 중복 지급되지 않는다. 서버는 SIGTERM을 받으면 처리 중인 요청을 마치고 종료한다

### 러너 (2026-10-03 설치 완료)

- `nas-runner-zzigame` (라벨 `nas`) — `/volume2/docker/github-runner-zzigame`, **jihoon40으로 실행**
  (root로 돌리면 러너가 "Must not run interactively with sudo"로 거부한다)
- 부팅 시 자동 시작: DSM 작업 스케줄러에 새 작업을 만들려면 root가 필요해서, 이미 부팅 작업으로 실행되는
  `/volume2/docker/github-runner-photoshare/start-runner.sh` 끝에 zzigame 러너 시작 한 줄을 붙였다
  (원하면 DSM에서 같은 명령으로 별도 부팅 작업을 만들고 그 줄을 지워도 된다)
- 다시 설치할 때: PC에서 `gh api -X POST repos/wlgns02048/zzigame/actions/runners/registration-token --jq .token`으로
  토큰(1시간 유효)을 받고, 나스에서 `sh /volume2/docker/github-runner-zzigame/setup.sh <토큰>` (sudo 없이)
- DSM에 `ldd` · `ldconfig`가 없어 설치 스크립트는 기존 러너용 대체 스크립트(`/var/services/homes/jihoon40/bin`)를 쓴다
- 컨테이너는 `restart: unless-stopped`라 나스를 재시작해도 다시 뜬다
- 내부망 확인: `http://192.168.50.2:13100`

## 외부 접속 — `https://Godlovesyou.synology.me:10443` (2026-10-03 설정 완료)

photoshare(`:9443`)와 같은 방식 — 기존 Synology DDNS 호스트명과 Let's Encrypt 인증서(기본 인증서)를 그대로 쓴다.
DuckDNS의 `icecrown-trial`은 GitHub Pages(main)용이므로 건드리지 않았다.

| 구성 | 내용 | 설정 방법 |
|---|---|---|
| DSM 리버스 프록시 | `zzigame`: HTTPS `Godlovesyou.synology.me:10443` → HTTP `localhost:13100` | `synowebapi` (root) |
| DSM 방화벽 | 기본 프로필 첫 규칙 허용 서비스에 `ReverseProxy_10443` 추가 (photoshare의 `ReverseProxy_9443`과 같은 방식) | `firewall.d/1.json` 수정 후 `synofirewall --reload` |
| 공유기 포트포워딩 | 외부 10443 → 192.168.50.2:10443 (UPnP) | `zzigame-upnp` 컨테이너가 30분마다 다시 등록 |
| 외부 확인 | 배포할 때마다 GitHub 서버에서 접속 확인 (`External access check` 작업) | `.github/workflows/deploy.yml` |

- DSM 시스템 설정은 jihoon40이 docker 그룹이라 컨테이너로 root 권한을 얻어
  (`docker run --rm --privileged --pid=host --network host alpine nsenter -t 1 -m -u -i -n -p -- …`) 실행했다.
  실행한 스크립트와 변경 전 백업: `/volume2/docker/github-runner-zzigame/sysconfig/` (`01_proxy.sh`, `02_firewall.sh`, `*.bak`)
- 되돌리기: DSM → 로그인 포털 → 리버스 프록시에서 `zzigame` 삭제, 방화벽은 `firewall-1.json.bak`을 되돌리고 `synofirewall --reload`
  (또는 DSM 방화벽 화면에서 `ReverseProxy_10443` 해제), `zzigame-upnp` 컨테이너 중지
- 인증서는 DSM 기본 인증서(Synology DDNS)가 자동으로 쓰인다. DSM이 갱신하면 그대로 따라간다

## 로컬 실행

```sh
DATA_DIR=C:/temp/zzigame-data PORT=8080 node server/server.js   # http://localhost:8080
```

DB 파일을 `Z:` 아래에 두지 말 것 (RaiDrive 문제, `../DOCKER_VOLUMES.md`).

## 백업

`data/game.db`(+ `-wal`, `-shm`)를 복사하면 된다. 컨테이너를 멈추고 복사하는 것이 가장 안전하다.
