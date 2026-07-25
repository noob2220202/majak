# handoff — AI 생성 원화 투입 폴더

여기에 이미지를 넣어주시면 클로드 코드가 톤 보정·크롭·WebP 최적화 후 게임에 통합하고, 그 위에 CSS 연출(현판 버튼·붓글씨·꽃잎·글로우·애니메이션)을 얹습니다 (PLAN.md §9-6, ART-DIRECTION.md).

## 생성 공통 규칙 (중요)

- **오리지널 디자인만**: 프롬프트에 타 게임명·타 게임 캐릭터명을 넣지 않는다. 참고작 캐릭터의 식별 조합(예: 단발+고양이귀+방울)을 그대로 재현하지 않는다.
- **같은 도구·같은 스타일**로 일괄 생성 (배경·캐릭터·버튼이 한 게임처럼 보이도록).
- **이미지 안에 글자·UI를 넣지 말 것** — 제목·버튼 텍스트·수치는 코드로 얹습니다.
- **원본 최고 해상도**로 저장 (압축은 이쪽에서 처리).
- 파일명은 아래 지정한 이름 그대로. 투입 후 "넣었어요"만 알려주시면 통합합니다.
- 투입한 이미지의 생성 도구·날짜를 `ATTRIBUTIONS.md`에 기록합니다.

---

## 우선순위 1 — 참고 이미지 느낌을 내는 필수 2장

### 1. `lobby-bg.png` — 로비 배경 (필수, 임팩트 최대)

- **주제**: 봄날의 한국 전통 궁궐 정원. 단청(청·녹) 칠한 처마와 회색 기와 곡선 지붕의 한옥 누각, 만개한 매화·벚꽃, 원경의 안개 낀 산, 돌길과 연못 위 작은 홍예교(아치 다리). 참고 이미지의 "밝은 봄 궁궐" 분위기.
- **구도(중요)**: 16:9 가로. **우측 절반과 좌하단은 비교적 비워둘 것** — 우측엔 메뉴, 좌하단엔 캐릭터가 올라갑니다. 원경 중심, 하늘은 상단 여백.
- **톤**: 밝고 화사하되 격조 있게. 분홍·연보라 꽃잎이 흩날리는 느낌. 회화풍(painterly), 고해상 애니 배경.
- **해상도/형식**: 2560×1440 이상, 16:9, PNG 또는 고품질 JPG.
- **예시 프롬프트 (EN, 복사용)**:
  > digital painting, anime game background art, traditional Korean royal palace garden in spring, hanok pavilion with blue and green dancheong painted eaves and grey curved tiled roof, cherry and plum blossoms in full bloom, distant misty mountains, stone path and a small arched stone bridge over a pond, soft warm afternoon light, pink and lavender petals drifting in the air, painterly, highly detailed, vibrant yet elegant, wide 16:9 composition, open sky in the upper area, relatively empty space on the right side and lower left, no people, no characters, no text, no watermark, no UI
- **밤 버전을 원하면** (우리 기본 톤과도 어울림): 위 프롬프트에서 `soft warm afternoon light` → `deep blue night sky with a large full moon, warm glowing traditional Korean lanterns (cheongsachorong), fireflies` 로 교체. 파일명은 `lobby-bg-night.png`.

### 2. `char-main.png` — 대표 캐릭터 (필수)

- **주제**: 오리지널 캐릭터 1명. **한복**(짧은 저고리 + 긴 치마, 노리개·댕기 등). 차분하고 당당한 서 있는 전신 포즈.
- **스타일**: 고품질 애니 일러스트, 부드러운 셀 셰이딩. 색은 게임 팔레트(홍·남·금) 계열 권장.
- **배경 처리(중요)**: **투명 배경 PNG**로 저장. 도구가 투명을 지원하지 않으면 **단색 순수 초록(#00FF00) 또는 순수 자홍(#FF00FF)** 배경으로 생성해 주세요 — 제가 그 색을 제거(키잉)해 오려냅니다.
- **해상도/형식**: 세로 1600×2600 이상, PNG, 전신(머리끝~발끝 다 보이게).
- **예시 프롬프트 (EN, 복사용)**:
  > original character concept art, full body anime illustration, a young woman wearing an elegant Korean hanbok, short jeogori jacket and long flowing chima skirt, norigae pendant and daenggi ribbon, gentle confident expression, standing pose, soft cel shading, detailed fabric patterns in deep red navy and gold, high quality anime style, transparent background, full body from head to toe, centered, no text, no watermark, original design
  >
  > (투명이 안 되면 끝에 `transparent background` 대신 `solid pure green screen background #00FF00, flat, no shadows on background` 사용)
- 머리 모양·소품(부채·도깨비뿔 등 한국적 판타지 요소)은 취향대로. 단 참고작 캐릭터를 닮게 하지 말 것.

---

## 우선순위 2 — 있으면 더 좋은 것 (없으면 제가 CSS/SVG로 대체)

### 3. `plaque.png` — 메뉴 현판/족자 텍스처 (선택)

- 빈 나무 현판 또는 두루마리 1개(글자 없이). 매듭·술 장식 포함 가능. 제가 위에 붓글씨(빠른대전·친선방 등)를 얹습니다.
- 투명 배경 PNG, 800×260 정도. **없으면 제가 CSS로 현판 버튼을 만듭니다** (이건 코드로도 꽤 잘 나옵니다).

### 4. `char-main-bust.png` — 대표 캐릭터 반신 (선택)

- 같은 캐릭터의 상반신 정면(가슴 위). 대국 좌석 아바타·화료 컷인용. 투명 PNG 1024×1024+.
- **없으면 `char-main.png`에서 크롭해서 씁니다.**

### 5. `table-bg.png` — 대국 테이블 배경 (선택, Phase 4 후반)

- 위에서 내려다본 마작상/대청마루 질감. 중앙이 비교적 균일하고 가장자리로 어두워지는(비네트) 구도. 2048×2048+.
- **없으면 제가 CSS 뇌록 펠트 + 질감으로 만듭니다.**

---

## 통합되면 이렇게 됩니다

1. `lobby-bg` → 로비 전체 배경으로 깔고 톤 보정 + 꽃잎/글로우 애니메이션 오버레이.
2. `char-main` → 좌하단 배치(살짝 페이드인·호버 반응).
3. 우측에 현판/족자 메뉴 버튼(붓글씨 서체) + 상단 프로필·엽전 바 + 단청 테두리를 **CSS로** 얹음.
4. 같은 방식으로 대기방·결과 화면에도 확장.

원화 품질이 곧 결과 품질입니다. 1·2번만 있어도 참고 이미지에 상당히 가까워집니다.
