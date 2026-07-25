# 청기와 (가칭)

한국 전통 미학을 입힌 온라인 4인 리치마작 웹게임. 전체 개발 계획은 [PLAN.md](./PLAN.md)를 참고하세요.

현재 상태: **Phase 5 — 엽전 경제·저잣거리·등급, 이모티콘 소통, 봇 v2, 모바일 레이아웃 완료**

엽전은 무료 재화입니다. 현금 결제·유저 간 거래·베팅은 없고, 저잣거리에서 파는 것은
전부 치레거리(코스메틱)라 승패·판정·매칭에 영향을 주지 않습니다 ([PLAN.md](./PLAN.md) §6.1).

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
| 등급 | 유생 → 진사 → 급제 → 장원. 순위 누적 점수제, 하한 0(강등 없음), 동풍전은 절반 |

패 뒷면과 화료 연출은 **산 사람 기준**으로 모두에게 보이고(상대 손패 뒷면 · 화료 병풍 색),
마작상은 **보는 사람 기준**으로 각자 자기 상 위에서 둡니다.

산 탈은 대국 중 상단 이모티콘 단추로 띄웁니다. 도배는 서버가 좌석당 3초 쿨다운으로 막고,
받는 쪽은 팔레트의 [숨기기]로 상대 이모티콘을 아예 안 볼 수 있습니다.

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

## 프로덕션 (단일 프로세스 서빙)

```sh
docker build -t cheongiwa .
docker run --rm -p 8787:8787 -v cheongiwa-data:/app/data cheongiwa
```

## 문서

- [PLAN.md](./PLAN.md) — 전체 개발 계획서 (룰 사양 · 디자인 시스템 · 로드맵)
- [ART-DIRECTION.md](./ART-DIRECTION.md) — 캐릭터·한복 비주얼 방향 (PLAN 부록)
- [RULES.md](./RULES.md) — 구현된 룰 최종 요약 (유저용)
- [ASSUMPTIONS.md](./ASSUMPTIONS.md) — 문서에 없어서 임의 결정한 사항
- [ATTRIBUTIONS.md](./ATTRIBUTIONS.md) — 외부 에셋 출처·라이선스
