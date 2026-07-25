# ATTRIBUTIONS — 외부 에셋 출처·라이선스

> 외부 리소스는 라이선스 확인 → 이 문서에 기록 → 사용. 라이선스 불명 리소스는 쓰지 않는다 (PLAN.md §9).

## 폰트 (§4.2 — 로컬 번들, 외부 CDN 의존 없음)

| 폰트 | 용도 | 출처 | 라이선스 |
|---|---|---|---|
| Noto Serif KR (700/900) | 제목·연출 (국 표시, 역 이름, 화료 연출) | Google Fonts | SIL Open Font License 1.1 |
| Pretendard (400/700) | UI 본문 | [orioncactus/pretendard](https://github.com/orioncactus/pretendard) v1.3.9 | SIL Open Font License 1.1 |

- 두 폰트 모두 OFL이므로 임베딩·서브셋·재배포가 허용된다 (§9-3 "폰트는 OFL만").
- `apps/client/public/fonts/*.woff2`는 `apps/client/scripts/build-fonts.mjs`가 생성한 **서브셋**이다.
  - Noto Serif KR: 소스에 실제 등장하는 한글/한자만 (Google Fonts `text=` 서브셋 API)
  - Pretendard: 라틴 + 상용 한글 음절 (pyftsubset)
- 재생성: `cd apps/client && node scripts/build-fonts.mjs` (fonttools·brotli 필요)

## 그래픽 — 벡터 (자체 제작)

- 마작패 앞면: 전통 공용 도안을 벡터/CJK 문자로 자체 구현 (§9-3)
- 패 뒷면·수막새·처마·단청·엽전·조각보·병풍: 오리지널 SVG
- 이모지·유니코드 마작 문자(🀇 등)는 전 화면 미사용 (§9-5)

## 그래픽 — 원화 (AI 생성)

| 항목 | 파일 | 생성 도구 | 날짜 |
|---|---|---|---|
| 배경 5종 (로비·대기방·숙소·대국 대청·결과) | `bg-*.jpg` | OpenAI `gpt-image-2` (high) | 2026-07-25 |
| 캐릭터 「단」 전신·반신·치비 | `char-dan-*.png` | OpenAI `gpt-image-1.5` (high, 투명) | 2026-07-25 |
| 메뉴 현판 4종 | `plaque-menu-*.png` | OpenAI `gpt-image-1.5` (high, 투명) | 2026-07-25 |
| 엽전 아이콘 | `icon-yeopjeon.png` | OpenAI `gpt-image-1.5` (high, 투명) | 2026-07-25 |
| 캐릭터 「매·설·루」 전신 | `char-{mae,seol,ru}-full.png` | OpenAI `gpt-image-1.5` (high, 투명) | 2026-07-25 |
| 배경 2종 (로비 야경·로딩) | `bg-lobby-night.jpg` · `bg-loading.jpg` | OpenAI `gpt-image-2` (medium) | 2026-07-25 |
| 프레임 11종 (모달·사이드·모서리·도라판·제목현판·아바타틀 2·카드틀·탭 2·걸개) | `panel-*` · `plaque-title` · `frame-*` · `tab-*` · `tag-inuse` | OpenAI `gpt-image-1.5` (medium, 투명) | 2026-07-25 |
| 버튼 3종 | `btn-{back,cta,option-off}.png` | OpenAI `gpt-image-1.5` (medium, 투명) | 2026-07-25 |
| 아이콘 12종 | `icon-*.png` | OpenAI `gpt-image-1.5` (medium, 투명) | 2026-07-25 |

- **전량 오리지널 생성물**이다. 프롬프트에 타 게임명·타 게임 캐릭터명을 넣지 않았고, 참고작의
  식별 요소(캐릭터 조합·문양·색 배치)를 재현하지 않았다 (§9-1).
- 프롬프트 원문은 `apps/client/scripts/art-manifest.mjs` 에 슬롯별로 그대로 남아 있어
  무엇이 어떻게 만들어졌는지 추적할 수 있다.
- 원본은 `apps/client/assets/handoff/`, 게임에 실리는 최적화본은 `apps/client/public/art/*.webp`.
  변환은 `cd apps/client && pnpm build-art` (여백 제거 → 축소 → WebP, 30MB → 1.9MB).
- 재생성: `OPENAI_API_KEY=... pnpm --filter @cheongiwa/client gen-art --stage 1`.
  생성은 결정론적이지 않으므로 **원본 파일이 곧 원본**이다 — 지우면 같은 그림은 다시 못 만든다.

## 사운드 (§4.6)

외부 샘플 없음 — Web Audio API로 실시간 합성 (`apps/client/src/audio/sfx.ts`).
타악·신스로 북·대금·가야금·태평소 음색을 근사한다.

## 대기 중 (핸드오프)

나머지 슬롯(아이콘 24 · 프레임 18 · 연출 14 · 탈 6 · 마작상 10 · 캐릭터 3인 · 로고 5)은
`apps/client/assets/handoff/README.md` 의 목록대로 준비 중이다.
투입되는 대로 위 표에 도구·날짜와 함께 추가한다.
