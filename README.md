# 청기와 (가칭)

한국 전통 미학을 입힌 온라인 4인 리치마작 웹게임. 전체 개발 계획은 [PLAN.md](./PLAN.md)를 참고하세요.

현재 상태: **Phase 5 — 엽전 경제·저잣거리, 급수·단 등급, 레이팅 매칭, 이모티콘 소통, 봇 v2, 모바일 레이아웃, 정식 계정 완료**

엽전은 무료 재화입니다. 현금 결제·유저 간 거래·베팅은 없고, 저잣거리에서 파는 것은
전부 치레거리(코스메틱)라 승패·판정·매칭에 영향을 주지 않습니다 ([PLAN.md](./PLAN.md) §6.1).

## 계정 (§3.1)

세 갈래로 들어옵니다.

| 방식 | 내용 |
|---|---|
| 게스트 | 닉네임만 입력하고 바로 대국. 기록은 이 브라우저의 세션 토큰에만 매입니다 |
| 가입 | 아이디(영문 소문자 시작 4~16자) + 비밀번호(8자 이상). **게스트로 놀던 중 가입하면 엽전·전적·등급·산 치레거리가 그대로 따라옵니다** |
| 로그인 | 기기마다 별도 세션이라 데스크톱·휴대폰에서 동시에 접속할 수 있습니다 |

- 비밀번호는 scrypt, 세션 토큰과 복구 코드는 SHA-256으로 **해시만** 저장합니다. 새 의존성은 없습니다(Node 내장 `crypto`).
- 이메일을 받지 않으므로 비밀번호 분실 대비는 **복구 코드**입니다. 가입·재설정 직후 한 번만 보여 주고 서버는 해시만 갖습니다. 한 번 쓰면 새 코드로 갈립니다.
- 비밀번호를 바꾸면 지금 쓰는 기기만 남고 다른 기기의 로그인은 끊깁니다.
- 로그인은 아이디별로 5회 실패하면 30초부터 최대 15분까지 잠깁니다. 실패 메시지는 아이디 존재 여부를 알려 주지 않습니다.
- 소셜 로그인(구글·카카오·네이버)은 `identities` 표만 미리 두고 붙이지 않았습니다 — 각 사 client id/secret과 공개 HTTPS 주소가 있어야 실제 동작을 확인할 수 있습니다.

## 개발 실행

요구사항: Node 20+ / pnpm 10 (`corepack enable`)

```sh
pnpm install
pnpm dev
```

- 클라이언트 (Vite): http://localhost:5173 — 닉네임 입력 → [연습 대국]으로 봇 3인과 즉시 대국, 또는 [친선방]으로 브라우저 2개 대국
- 서버 헬스체크 (Fastify + Socket.IO): http://localhost:8787/healthz

대국 진행 속도(봇/결과 지연)는 서버 환경변수로 조정: `BOT_DELAY_MS` `RESULT_DELAY_MS` `TURN_BASE_MS` `RESERVE_MS`.

## 스크립트

| 명령 | 내용 |
|---|---|
| `pnpm dev` | 서버 + 클라 동시 기동 |
| `pnpm test` | 전 패키지 vitest |
| `pnpm lint` / `pnpm typecheck` | ESLint / tsc --noEmit |
| `pnpm build` | 클라 정적 빌드 + 서버 번들 |
| `pnpm --filter @cheongiwa/client e2e` | Playwright E2E 스모크 (브라우저 필요) |
| `cd apps/client && node scripts/build-fonts.mjs` | 로컬 폰트 서브셋 재생성 (fonttools 필요) |

## 구조 (pnpm 모노레포)

```
packages/engine    순수 TS 마작 엔진 (런타임 의존성 0, 결정론적)
packages/protocol  공유 타입 · 룰 설정 zod 스키마 · 프로토콜 버전
apps/server       Fastify + Socket.IO 게임 서버 (정적 서빙 · 헬스체크)
apps/client       React 18 + Vite 클라이언트
```

## 엽전·저잣거리·등급 (Phase 5)

| 항목 | 내용 |
|---|---|
| 획득 | 완주 반장 100냥 / 동풍 50냥, 순위 80·40·20·10, 오늘의 첫 대국 50, 역만 화료 기념 500 |
| 지급 조건 | 인간 2인 이상 · 연습 대국 아님 · 본인 완주. `gameId` 기준 멱등 |
| 빈곤 구제 | 잔액 200냥 미만이면 접속 시 하루 1회 200냥까지 보충 |
| 소비 | 저잣거리 구매만. 지갑 변경은 전부 원장(append-only)에 사유와 함께 기록 |
| 상품 | 패 뒷면 4 · 마작상 4 · 화료 연출 3 · 이모티콘(탈) 6 (슬롯마다 무료 기본품 1개) |
| 등급 | 유생 → 진사 → 급제 → 장원 (아래 "등급과 레이팅 매칭" 절 참고) |

패 뒷면과 화료 연출은 **산 사람 기준**으로 모두에게 보이고(상대 손패 뒷면 · 화료 병풍 색),
마작상은 **보는 사람 기준**으로 각자 자기 상 위에서 둡니다.

산 탈은 대국 중 상단 이모티콘 단추로 띄웁니다. 도배는 서버가 좌석당 3초 쿨다운으로 막고,
받는 쪽은 팔레트의 [숨기기]로 상대 이모티콘을 아예 안 볼 수 있습니다.

## 등급과 레이팅 매칭 (§3.2)

안쪽에는 **MMR 하나**만 있고, 겉으로 보이는 것은 **티어 하나**뿐입니다.
MMR 수치는 어떤 응답에도 실리지 않습니다 — 매칭 상대를 고르고 등락을 계산하는 데만 씁니다.

| | 보이는 것 | 안 보이는 것 |
|---|---|---|
| | 티어 표기 — "진사 4급" | MMR |
| 쓰임 | 잔액바·좌석 이름표·결과 화면 | 매칭 상대 선정, 티어 산출 |

- **급수는 내려가고 단은 올라갑니다.** 유생·진사·급제는 각각 9급에서 1급까지 내려가고,
  최고 등급인 장원만 1단에서 9단으로 올라갑니다 (바둑·태권도와 같은 방향).
- 티어는 MMR 구간의 이름이라 **강등이 있습니다.** 티어가 지금 실력을 뜻하려면 그래야 합니다.
- 처음 5국은 **배치 대국**이라 등급이 크게 움직입니다.
- MMR 등락: `순위점 + (평균 상대 MMR − 내 MMR)/40`, 대국 수가 쌓일수록 변동 축소.
  동풍전은 분산이 커서 0.8배.
- 빠른 대전은 실력 차 **±200**부터 찾기 시작해 1초에 20씩 넓히고 ±3000에서 멈춥니다.
  대기 화면에는 숫자 대신 "비슷한 실력대에서 찾는 중 → 범위를 넓혀 찾는 중"으로 보입니다.
- 양쪽이 서로의 폭 안에 들어야 붙입니다. 실력이 외진 사람은 큐 앞에 있어도 뒤를 막지 않고,
  대신 60초 뒤 봇 충원을 제안받습니다.

## 세로 화면 (모바일)

폰 세로 화면에서도 가로 스크롤 없이 둘 수 있습니다.

- 손패는 가용 폭에 맞춰 한 장 폭을 역산하고, 마작상은 600px 논리 좌표계를 통째로 축소해
  어떤 화면 폭에서도 자리·비율이 그대로 유지됩니다. 눕힌 화면에서는 세로가 먼저 바닥나므로
  가로·세로 중 작은 쪽에 맞춥니다.
- 손패는 늘 화면 아래(엄지 닿는 자리)에 두고, 콜 도장 버튼은 좁을 때 손패 위로 올라갑니다.
- 설정·역 일람·기록은 `lg` 미만에서 상단 [설정] 단추 → 우측 서랍으로 엽니다.
- 회귀 테스트: `apps/client/e2e/mobile.spec.ts` (390×844 · 눕힌 844×390 · 320×568)

## 터미널 대국 데모 (Phase 2)

서버를 켠 뒤 (`pnpm dev` 또는 빌드 후 `pnpm --filter @cheongiwa/server start`):

```sh
cd apps/server
npx tsx scripts/play-cli.ts --nick 갑 --create          # 방 코드가 출력됨, Enter로 시작
npx tsx scripts/play-cli.ts --nick 을 --join <코드>     # 터미널 2~4
npx tsx scripts/play-cli.ts --nick 혼자 --practice      # 봇 3인과 즉시 대국
```

`--auto`(전자동) · `--quick`(매칭 큐) · `--token <값>`(재접속). 서버 환경변수:
`PORT` `DB_PATH` `STATIC_DIR` `TURN_BASE_MS` `RESERVE_MS` `RESULT_DELAY_MS` `BOT_DELAY_MS`

## 서버에 올리기 (도커 없이)

클라 정적 파일과 WebSocket 서버가 **한 프로세스**라 포트 하나만 열면 됩니다.
아래는 포트 7000 기준이고, `PORT` 만 바꾸면 어느 포트로든 됩니다.

### 1. 준비물

```sh
node -v            # v20 이상 (v22 권장)
corepack enable    # pnpm 준비
```

`better-sqlite3` 가 네이티브 모듈입니다. 미리 빌드된 바이너리가 없는 환경이면
컴파일 도구가 필요합니다 (설치 중 `gyp` 오류가 나면 이것부터):

```sh
sudo apt-get install -y build-essential python3   # 데비안·우분투
```

### 2. 클론

기본 브랜치가 아직 없고 작업 브랜치 하나만 있습니다.

```sh
git clone -b claude/cheongiwa-riichi-mahjong-6xko42 \
  https://github.com/noob2220202/majak.git cheongiwa
cd cheongiwa
```

### 3. 설치·빌드

```sh
pnpm install
pnpm build          # 클라 정적 파일 + 서버 단일 번들
```

### 4. 실행

```sh
PORT=7000 DB_PATH=$PWD/data/cheongiwa.db pnpm --filter @cheongiwa/server start
```

- 클라 경로(`apps/client/dist`)는 자동으로 찾습니다. 다른 곳에 두려면 `STATIC_DIR` 지정.
- `DB_PATH` 를 생략하면 실행 위치 기준 `data/cheongiwa.db` 에 만들어집니다. 어디에
  쌓이는지 헷갈리지 않게 절대경로로 주는 편이 낫습니다.
- `0.0.0.0` 에 바인딩하므로 같은 네트워크에서 바로 접속됩니다.

확인:

```sh
curl -s localhost:7000/healthz     # {"ok":true,...}
```

브라우저에서 `http://<서버주소>:7000` — 닉네임 넣고 [연습 대국]이면 봇 3인과 바로 둡니다.

방화벽이 있으면 포트를 열어 주세요.

```sh
sudo ufw allow 7000/tcp            # ufw
```

### 5. 상시 구동 (systemd)

터미널을 닫아도 살아 있게 하려면 `/etc/systemd/system/cheongiwa.service`:

```ini
[Unit]
Description=Cheongiwa mahjong server
After=network.target

[Service]
Type=simple
User=<사용자>
WorkingDirectory=/home/<사용자>/cheongiwa
Environment=NODE_ENV=production
Environment=PORT=7000
Environment=DB_PATH=/home/<사용자>/cheongiwa/data/cheongiwa.db
ExecStart=/usr/bin/node apps/server/dist/index.cjs
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now cheongiwa
journalctl -u cheongiwa -f          # 로그
```

### 6. 업데이트

```sh
git pull
pnpm install
pnpm build
sudo systemctl restart cheongiwa
```

DB는 `data/` 에 따로 있으니 재빌드해도 전적·엽전·계정이 남습니다. 스키마가 바뀌면
서버가 켜질 때 자동으로 맞춥니다.

### 7. 도메인·HTTPS를 붙일 때

WebSocket 을 쓰므로 리버스 프록시에 **업그레이드 헤더**를 반드시 넘겨야 합니다.
빠뜨리면 화면은 떠도 대국이 시작되지 않습니다.

```nginx
location / {
  proxy_pass http://127.0.0.1:7000;
  proxy_http_version 1.1;
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";
  proxy_set_header Host $host;
  proxy_read_timeout 3600s;     # 대국이 길다
}
```

Caddy 면 `reverse_proxy 127.0.0.1:7000` 한 줄로 끝나고 HTTPS까지 자동입니다.

### 도커로 하고 싶다면

```sh
docker build -t cheongiwa .
docker run -d -p 7000:8787 -v cheongiwa-data:/app/data cheongiwa
```

## 문서

- [PLAN.md](./PLAN.md) — 전체 개발 계획서 (룰 사양 · 디자인 시스템 · 로드맵)
- [ART-DIRECTION.md](./ART-DIRECTION.md) — 캐릭터·한복 비주얼 방향 (PLAN 부록)
- [RULES.md](./RULES.md) — 구현된 룰 최종 요약 (유저용)
- [ASSUMPTIONS.md](./ASSUMPTIONS.md) — 문서에 없어서 임의 결정한 사항
- [ATTRIBUTIONS.md](./ATTRIBUTIONS.md) — 외부 에셋 출처·라이선스
