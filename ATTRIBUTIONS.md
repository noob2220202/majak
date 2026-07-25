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

## 그래픽

전부 자체 제작 SVG/CSS — 외부 이미지 에셋 없음.

- 마작패 앞면: 전통 공용 도안을 벡터/CJK 문자로 자체 구현 (§9-3)
- 패 뒷면·수막새·처마·단청·엽전·조각보·병풍: 오리지널 SVG
- 이모지·유니코드 마작 문자(🀇 등)는 전 화면 미사용 (§9-5)

## 사운드 (§4.6)

외부 샘플 없음 — Web Audio API로 실시간 합성 (`apps/client/src/audio/sfx.ts`).
타악·신스로 북·대금·가야금·태평소 음색을 근사한다.

## 대기 중 (핸드오프)

로비 배경·캐릭터 원화는 생성 이미지로 준비 예정.
투입되면 도구·날짜와 함께 여기에 기록한다 (사양: `apps/client/assets/handoff/README.md`).
