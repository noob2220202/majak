# handoff — AI 생성 원화 투입 폴더

여기에 이미지를 넣어주시면 클로드 코드가 톤 보정·크롭·WebP 최적화 후 게임에 통합합니다 (PLAN.md §9-6, ART-DIRECTION.md).

## 공통 규칙

- **오리지널 디자인만**: 프롬프트에 타 게임명·타 게임 캐릭터명을 넣지 않는다. 실존 게임 캐릭터와 닮은 결과물은 사용하지 않는다.
- **동일 화풍 유지**: 같은 도구·같은 스타일 설정으로 일괄 생성 (캐릭터·배경이 한 게임처럼 보여야 함).
- **원본 최고 해상도**로 저장 (압축은 이쪽에서 처리).
- 파일명: 영문 소문자-하이픈 (예: `lobby-bg-night.png`, `char-main-full.png`).
- 투입 후 생성 도구·날짜를 알려주시면 `ATTRIBUTIONS.md`에 기록합니다.

## 우선순위 1 — Phase 4 최소셋

### 1. `lobby-bg-*.png` — 로비 배경 원화 (필수)

- **주제**: 봄밤의 고궁. 원경에 전각(누각), 매화 또는 배꽃, 청사초롱·연등 불빛. 하늘은 깊은 남색(쪽빛).
- **구도**: 수평선을 하단 1/3에. 좌측 하단은 캐릭터가 설 자리, 우측 절반은 메뉴가 놓일 자리이므로 **시각적으로 복잡하지 않게** 비워둘 것. 원경 중심 구도.
- **톤**: 어두운 남색 바탕 + 금빛 등불 (게임 팔레트: 쪽빛 `#101528`~`#2C3040`, 금 `#C8A24B`와 어울리게).
- **해상도**: 2560×1440 이상, 16:9, PNG 또는 고품질 JPG.
- **예시 프롬프트 (EN)**:
  > anime background art, traditional Korean palace pavilion at spring night, plum blossoms, blue-indigo night sky, warm glow of traditional Korean lanterns (cheongsachorong), distant wide composition, lower third horizon, empty foreground space, painterly digital art, no people, no text

### 2. `char-main-full.png` — 대표 캐릭터 입상 (필수)

- **주제**: 오리지널 캐릭터 1명. **한복** 착용 (저고리+치마 또는 두루마기, 댕기·노리개 등 세부 장식). 차분하고 당당한 서 있는 포즈, 전신(발끝까지).
- **스타일**: 고품질 애니메이션 일러스트. 배경 원화와 톤 조화 (색은 게임 팔레트의 홍/남/금 계열 권장).
- **형식**: **투명 배경 PNG**, 세로 2000px 이상 (2048~4096 권장).
- **예시 프롬프트 (EN)**:
  > original anime character, full body standing illustration, young woman wearing traditional Korean hanbok (jeogori and chima) with norigae pendant and daenggi ribbon, elegant confident pose, high quality anime illustration, transparent background, full body head to toe, deep red and navy and gold color scheme, no text
- 캐릭터의 성별·머리 모양·소품(부채, 곰방대, 도깨비 뿔 등 한국적 판타지 요소)은 취향대로. 단 참고작 캐릭터의 식별 조합(단발+고양이귀+방울 등)은 피할 것.

### 3. `char-main-bust.png` — 대표 캐릭터 반신 (권장, 생략 가능)

- 같은 캐릭터의 상반신(가슴 위) 정면. 좌석 아바타·화료 컷인용.
- 투명 배경 PNG, 1024×1024 이상. **입상(#2)에서 크롭으로 대체 가능**하므로 없어도 진행됩니다.

### 4. 봇 아바타 3종 (선택)

- 기본은 클로드 코드가 탈 문양 SVG(하회탈 계열 3종)로 제작합니다. 캐릭터 일러스트로 하고 싶으면 `char-bot1-bust.png` 형식으로 3장 추가.

## 우선순위 2 — Phase 5 확장 (지금은 불필요)

- 추가 캐릭터 2~3명 (같은 화풍 시리즈, 입상+반신)
- 캐릭터 갤러리 배경 (한옥 내실, 은은한 조명)
- SD(치비) 도우미 캐릭터 (튜토리얼용)
- 화료 전용 컷인 일러스트 (역만급 연출용)
