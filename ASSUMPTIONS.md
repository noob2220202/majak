# ASSUMPTIONS — 문서에 없어서 임의 결정한 사항

> 형식: `[Phase] 결정 내용 — 근거` (룰 관련 결정은 엔진 테스트를 함께 추가한다)

- [Phase 0] 저장소 루트를 모노레포 루트로 사용 — PLAN.md §1.1의 `cheongiwa/` 디렉터리가 곧 이 리포지토리 루트.
- [Phase 0] 브랜치 운영: 호스팅 환경 지침에 따라 지정 브랜치(`claude/cheongiwa-riichi-mahjong-6xko42`) 하나에서 개발 — §10.3의 "Phase별 브랜치 후 머지" 대신 conventional commits 단위만 유지.
- [Phase 0] 폰트(Noto Serif KR·Pretendard) 로컬 번들은 Phase 4에서 도입 — 그때까지 시스템 폰트 폴백 사용, 외부 CDN 미사용 원칙(§4.2)은 준수.
- [Phase 0] 포트: 서버 8787(`PORT` env로 변경), 클라 개발 서버 5173 — vite 프록시로 same-origin 통신하여 CORS 설정 불필요.
- [Phase 0] Node 22 LTS를 CI·Docker 기준으로 사용 — 요구 최저선은 문서대로 Node 20 (`engines.node >= 20`).
- [Phase 0] Tailwind CSS v4(CSS-first) 채택 — §4.1 토큰은 `:root` CSS 변수(문서 표기 그대로 `--ink` 등)로 정의하고 `@theme inline`으로 유틸리티에 매핑.
- [Phase 0] 서버 프로덕션 빌드는 tsup CJS 단일 번들(워크스페이스 패키지 포함 전부 번들) — 런타임 node_modules 불필요. Phase 2에서 better-sqlite3(네이티브 모듈) 도입 시 external 전환 예정.
- [Phase 0] 패 표기는 mpsz 표기법(`1m~9m / 1p~9p / 1s~9s / 1z~7z`, 적5는 `0m·0p·0s`)을 로그·테스트 픽스처 표준으로 사용.
- [Phase 0] 프로토콜 버전 상수 `PROTOCOL_VERSION = 1`에서 시작 — 이벤트·스냅샷 스키마의 파괴적 변경마다 +1.
- [Phase 0] 패키지 스코프는 `@cheongiwa/*` (engine · protocol · server · client).
- [방향 개정 2026-07-24] 사용자 결정으로 캐릭터를 순수 비주얼 요소(과금·가챠·판정 영향 없음)로 도입 — 상세는 `ART-DIRECTION.md`. PLAN.md §0의 "캐릭터 없음"은 이 범위에서 개정됨.
