# 청기와 (가칭)

한국 전통 미학을 입힌 온라인 4인 리치마작 웹게임. 전체 개발 계획은 [PLAN.md](./PLAN.md)를 참고하세요.

현재 상태: **Phase 0 — 스캐폴드** (모노레포·서버·클라 골격, 플레이스홀더 로비)

## 개발 실행

요구사항: Node 20+ / pnpm 10 (`corepack enable`)

```sh
pnpm install
pnpm dev
```

- 클라이언트 (Vite): http://localhost:5173
- 서버 헬스체크 (Fastify + Socket.IO): http://localhost:8787/healthz

## 스크립트

| 명령 | 내용 |
|---|---|
| `pnpm dev` | 서버 + 클라 동시 기동 |
| `pnpm test` | 전 패키지 vitest |
| `pnpm lint` / `pnpm typecheck` | ESLint / tsc --noEmit |
| `pnpm build` | 클라 정적 빌드 + 서버 번들 |

## 구조 (pnpm 모노레포)

```
packages/engine    순수 TS 마작 엔진 (런타임 의존성 0, 결정론적)
packages/protocol  공유 타입 · 룰 설정 zod 스키마 · 프로토콜 버전
apps/server       Fastify + Socket.IO 게임 서버 (정적 서빙 · 헬스체크)
apps/client       React 18 + Vite 클라이언트
```

## 프로덕션 (단일 프로세스 서빙)

```sh
docker build -t cheongiwa .
docker run --rm -p 8787:8787 cheongiwa
```

## 문서

- [PLAN.md](./PLAN.md) — 전체 개발 계획서 (룰 사양 · 디자인 시스템 · 로드맵)
- [RULES.md](./RULES.md) — 구현된 룰 최종 요약 (유저용)
- [ASSUMPTIONS.md](./ASSUMPTIONS.md) — 문서에 없어서 임의 결정한 사항
- [ATTRIBUTIONS.md](./ATTRIBUTIONS.md) — 외부 에셋 출처·라이선스
