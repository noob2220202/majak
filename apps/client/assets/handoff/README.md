# handoff — 원화 에셋 투입 폴더 (전체 목록)

레퍼런스 화면 6종(로비 / 숙소 / 대국 / 화료결과 / 방생성 / 튜토리얼)을 **한국 기와 버전**으로
만들기 위해 필요한 이미지 **전량**입니다. 여기에 넣어주시면 톤 보정·크롭·WebP 최적화 후
게임에 통합하고 그 위에 코드 연출(글자·애니메이션·상태 변화)을 얹습니다.

> **먼저 읽어주세요 — 지금 당장은 12장이면 됩니다.**
> 아래 전체 목록은 140장 가까이 되지만, **[§1 배경 5장 + §2 캐릭터 1명 3장 + §5 현판 4장]**
> 이 12장만 있으면 화면 인상이 레퍼런스급으로 바뀝니다. 나머지는 제가 SVG/CSS로 버티고 있다가
> 오는 대로 교체합니다. 우선순위는 각 항목의 `★` 로 표시했습니다.
> `★★★` 필수 · `★★` 강력추천 · `★` 있으면 좋음(없으면 코드로 대체 중)

---

## 0. 공통 규칙 (전 항목 적용)

| 항목 | 규칙 |
|---|---|
| **오리지널만** | 프롬프트에 타 게임명·타 게임 캐릭터명을 넣지 않습니다. 레퍼런스에서 가져오는 건 **화면 배치와 정보 구조**뿐이고, 그림·캐릭터·문양은 전부 새로 만듭니다 (PLAN.md §9-1). |
| **글자 금지** | 이미지 안에 한글·한자·숫자·UI 텍스트를 넣지 마세요. 제목·버튼 문구·수치는 전부 코드로 얹습니다. 프롬프트 끝에 항상 `no text, no watermark, no UI, no letters` 를 붙여주세요. (예외: §7 콜 도장, §9-2 워드마크) |
| **같은 도구·같은 설정** | 배경/캐릭터/버튼을 **한 세션에서 같은 모델·같은 스타일 키워드**로 뽑아야 한 게임처럼 보입니다. 스타일 고정 문구는 §0-1. |
| **투명 배경** | `PNG 투명` 이라고 적힌 건 알파 채널 필수. 도구가 투명을 못 하면 **순수 초록 `#00FF00`** 배경으로 뽑아주세요 — 제가 키잉해서 오려냅니다. |
| **해상도** | 표에 적힌 크기는 **최소값**입니다. 더 크게 뽑아 주시면 좋습니다(압축은 제가 합니다). |
| **파일명** | 표의 이름 **그대로**. 이름이 슬롯이라 다르면 자동 연결이 안 됩니다. |
| **기록** | 투입하신 이미지의 생성 도구·날짜를 `ATTRIBUTIONS.md`에 남깁니다. |

### 0-1. 스타일 고정 문구 (모든 프롬프트 끝에 붙이기)

```
painterly anime game art, soft cel shading, elegant Korean traditional aesthetic,
dancheong color palette (deep indigo, vermilion red, jade green, gold leaf),
grey curved giwa roof tiles, high detail, no text, no watermark, no UI, no letters
```

### 0-2. 일본 → 한국 치환표 (레퍼런스를 한국 기와 버전으로)

| 레퍼런스(일본) | 우리(한국) | 영문 프롬프트 키워드 |
|---|---|---|
| 신사·토리이 | 궁궐 정전·솟을대문·홍살문 | `Korean palace main hall, hongsalmun red spiked gate` |
| 일본식 기와·박공 | **회색 기와 곡선 지붕 + 단청 처마** | `grey curved giwa roof, dancheong painted eaves` |
| 종이 등롱 | **청사초롱** (청·홍 비단 등) | `cheongsachorong, blue and red silk lantern` |
| 다다미·장지문 | 대청마루·창호지문 | `daecheong wooden floor, changhoji paper door` |
| 마네키네코 | **해태 / 까치호랑이** | `haetae guardian lion statue / magpie-and-tiger folk painting` |
| 코이노보리 | 잉어·학·연꽃 | `carp, crane, lotus` |
| 기모노·하카마 | **한복** (저고리·치마·도포·갓) | `hanbok, jeogori, chima, dopo, gat hat` |
| 벚꽃 단독 | 매화·살구꽃·벚꽃 혼합 | `plum blossom, apricot blossom, cherry blossom` |
| 일본 정원 | 궁궐 후원·석등·홍예교 | `palace rear garden, stone lantern, arched stone bridge` |
| 절 종·부적 | 수막새·풍경·오방색 매듭 | `roof-end tile medallion, wind chime, obangsaek knot` |

---

## 1. 배경 (7장) — ★★★ 최우선

레퍼런스에서 **인상의 80%를 만드는 건 배경 원화**입니다. 이것만 바뀌어도 완전히 달라집니다.

| # | 파일명 | 크기 | 형식 | 화면 | ★ |
|---|---|---|---|---|---|
| 1-1 | `bg-lobby.jpg` | 2560×1440 (16:9) | JPG | 로비 메인 | ★★★ |
| 1-2 | `bg-lobby-night.jpg` | 2560×1440 | JPG | 로비 야간 전환(선택) | ★ |
| 1-3 | `bg-room.jpg` | 2560×1440 | JPG | 방 생성 · 대기방 | ★★★ |
| 1-4 | `bg-quarters.jpg` | 2560×1440 | JPG | 숙소(캐릭터 선택) | ★★ |
| 1-5 | `bg-hall.jpg` | 2560×1440 | JPG | 대국 화면 — 마작상 **뒤** 공간 | ★★★ |
| 1-6 | `bg-result.jpg` | 2560×1440 | JPG | 화료 결과 | ★★ |
| 1-7 | `bg-loading.jpg` | 2560×1440 | JPG | 로딩 | ★ |

### 세이프존 (중요 — 이거 안 지키면 UI에 가려집니다)

```
bg-lobby.jpg
┌──────────────────────────────────────────┐
│ ← 재화·알림 UI          메뉴 현판 4개  → │  상단 12% / 우측 40% : 디테일 낮게
│                                          │
│        [ 원경: 궁궐 + 산 + 꽃 ]           │  중앙 좌측 : 여기가 주인공
│                                          │
│  ← 캐릭터 전신 자리         하단 네비 →   │  좌측 30% · 하단 12% : 비워둘 것
└──────────────────────────────────────────┘
```
- `bg-hall.jpg`는 **화면 중앙 60%가 마작상에 완전히 가려집니다.** 좌우 기둥·벽·창호만 보이므로
  중앙은 어둡고 단순하게, 좌우 가장자리에 한옥 실내 디테일(기둥·창호문·청사초롱)을 두세요.
- `bg-result.jpg`는 UI가 빽빽하게 올라갑니다. **거의 추상**으로 — 남색 그라데이션 + 매화 실루엣 + 사선 광선.
- `bg-quarters.jpg`는 **좌측 절반을 비워야** 캐릭터 전신이 들어갑니다.

### 프롬프트 (복사용)

**1-1 `bg-lobby.jpg`**
> digital painting, anime game background art, traditional Korean royal palace garden in spring, hanok pavilion with grey curved giwa tiled roof and blue-green dancheong painted eaves, plum and cherry blossoms in full bloom, distant misty mountains, stone path, stone lantern, small arched stone bridge over a clear pond, warm late-afternoon light, pink and lavender petals drifting, wide 16:9 composition, open sky in upper area, **relatively empty and low-detail on the right 40% and the lower left**, no people, no characters, painterly anime game art, soft cel shading, elegant Korean traditional aesthetic, high detail, no text, no watermark, no UI, no letters

**1-2 `bg-lobby-night.jpg`** — 위 문장에서 `warm late-afternoon light` → 아래로 교체
> deep indigo night sky with a large full moon, warm glowing cheongsachorong blue-and-red silk lanterns hanging along the eaves, fireflies, moonlight reflecting on the pond

**1-3 `bg-room.jpg`**
> same Korean palace garden seen from a lower angle looking up at the main gate, hongsalmun red spiked gate, courtyard with flagstones, blossom trees framing both sides, softer and slightly darker overall so UI panels read on top, wide 16:9, no people, (스타일 고정 문구)

**1-4 `bg-quarters.jpg`**
> interior of a traditional Korean hanok room at night, daecheong wooden floor, changhoji paper sliding doors with moonlight behind, low lacquered table, cheongsachorong lanterns glowing warm, folding screen with ink landscape painting, cozy and dim, wide 16:9, **empty space on the left half for a standing character**, no people, (스타일 고정 문구)

**1-5 `bg-hall.jpg`**
> dark interior of a Korean hanok hall seen from a seated viewpoint, thick wooden pillars on the far left and far right, changhoji paper doors, a single warm light source from above, the **entire center is dark, empty and out of focus**, deep indigo and warm brown, vignette, wide 16:9, no people, no furniture in the center, (스타일 고정 문구)

**1-6 `bg-result.jpg`**
> abstract deep indigo background, large soft plum blossom silhouettes, diagonal light rays from the upper left, subtle gold dust, dark and calm so bright UI text reads clearly, minimal, wide 16:9, (스타일 고정 문구)

**1-7 `bg-loading.jpg`**
> a single Korean roof-end tile medallion motif on a deep indigo ink-wash background, minimal, elegant, centered, wide 16:9, (스타일 고정 문구)

---

## 2. 캐릭터 (1명당 4장) — ★★★

레퍼런스는 캐릭터가 화면의 얼굴입니다. **최소 1명**부터 시작해도 되고, 좌석 4개를 다 채우려면 4명입니다.

### 캐릭터 1명당 필요한 것

| # | 파일명 | 크기 | 형식 | 용도 | ★ |
|---|---|---|---|---|---|
| 2-a | `char-<id>-full.png` | 1600×2600 (세로) | **PNG 투명** | 로비·숙소·결과 화면 전신 입상 | ★★★ |
| 2-b | `char-<id>-bust.png` | 1024×1024 | **PNG 투명** | 대국 좌석 아바타 · 숙소 카드 | ★★★ |
| 2-c | `char-<id>-sd.png` | 800×1000 | **PNG 투명** | 튜토리얼·안내 치비(2~3등신) | ★ |
| 2-d | `char-<id>-cutin.png` | 1200×1200 | **PNG 투명** | 리치·화료 컷인 (상반신 동적 포즈) | ★ |

`<id>`는 소문자 영문: 예) `dan`, `mae`, `seol`, `ru`

### 권장 캐릭터 4인 (한복 콘셉트)

| id | 콘셉트 | 한복 | 소품 |
|---|---|---|---|
| `dan` | 단정한 규수 — 대표 캐릭터 | 다홍 저고리 + 남색 치마 | 노리개, 댕기, 부채 |
| `mae` | 활달한 소녀 | 연분홍 저고리 + 옥색 치마 | 매화 머리꽂이, 나비 |
| `seol` | 서늘한 선비 | 흰 도포 + 갓 | 먹·붓, 두루마리 |
| `ru` | 도깨비 판타지 | 검푸른 철릭 | 도깨비 뿔, 오방색 방울 |

### 프롬프트 (2-a 전신, `dan` 예시)

> original character concept art, full body anime illustration, a young Korean woman wearing an elegant hanbok, short crimson jeogori jacket with wide sleeves and a long flowing navy chima skirt, norigae ornament pendant, long braided hair with a red daenggi ribbon, holding a folding fan, calm confident expression, standing pose facing slightly to the side, **full body visible from head to toe, centered, feet included**, detailed embroidered fabric patterns, painterly anime game art, soft cel shading, dancheong color palette, **transparent background**, no text, no watermark, no UI, no letters, original design
>
> *(투명이 안 되면 `transparent background` → `solid pure green screen background #00FF00, flat, evenly lit, no shadow cast on the background`)*

- **2-b 반신**: 위에서 `full body ... feet included` → `bust shot from the chest up, facing the viewer, centered`
- **2-c 치비**: → `chibi super-deformed 2-head-tall version, cute, simple, standing`
- **2-d 컷인**: → `upper body dynamic pose, dramatic lighting, confident smile, motion in hair and sleeves`

> **주의**: 레퍼런스 캐릭터의 식별 조합(단발 + 고양이귀 + 금방울 + 특정 배색)을 그대로 재현하지 마세요.
> 한복·머리모양·소품으로 완전히 다른 인물을 만들어 주세요.

---

## 3. 마작패 (38칸) — ★ (지금은 SVG로 잘 나오는 중)

**지금 SVG로 그리고 있고 어느 크기에서도 선명합니다.** 레퍼런스처럼 회화풍 각인 질감을 원하시면 그때 교체합니다.
넣으신다면 **스프라이트시트 1장**이 제일 편합니다.

| # | 파일명 | 크기 | 형식 | 내용 | ★ |
|---|---|---|---|---|---|
| 3-1 | `tiles-faces.png` | 칸당 256×342, 8열×5행 | PNG 투명 | 만수 1-9 · 통수 1-9 · 삭수 1-9 · 풍패 4(東南西北) · 삼원패 3(白發中) = **34종** + 적5 3종 = **37칸** | ★ |
| 3-2 | `tile-back-sumaksae.png` | 256×342 | PNG 투명 | 패 뒷면 코스메틱 ①수막새 | ★ |
| 3-3 | `tile-back-yeonhwa.png` | 256×342 | PNG 투명 | ②연화문 | ★ |
| 3-4 | `tile-back-dokkaebi.png` | 256×342 | PNG 투명 | ③도깨비문 | ★ |
| 3-5 | `tile-back-taegeuk.png` | 256×342 | PNG 투명 | ④태극 | ★ |
| 3-6 | `tile-side.png` | 256×120 | PNG 투명 | 패 측면(입체감용, 선택) | ★ |

> 개별 파일도 받습니다: `tile-m1.png … tile-m9.png`, `tile-p1~p9`, `tile-s1~s9`,
> `tile-z1~z7`(동남서북백발중), `tile-m0/p0/s0`(적5).

---

## 4. 마작상 (10장) — ★★

| # | 파일명 | 크기 | 형식 | 내용 | ★ |
|---|---|---|---|---|---|
| 4-1 | `table-felt-noirok.jpg` | 1400×1400 | JPG | 펠트 질감 ①뇌록(짙은 녹) | ★★ |
| 4-2 | `table-felt-jjokbit.jpg` | 1400×1400 | JPG | ②쪽빛(남색) | ★★ |
| 4-3 | `table-felt-meok.jpg` | 1400×1400 | JPG | ③먹(검정) | ★★ |
| 4-4 | `table-felt-jadan.jpg` | 1400×1400 | JPG | ④자단(적갈) | ★★ |
| 4-5~8 | `table-rim-<noirok\|jjokbit\|meok\|jadan>.png` | 1600×1600 | PNG 투명 | 위 4종의 나무 테두리(액자형) | ★ |
| 4-9 | `table-center.png` | 512×512 | PNG 투명 | 중앙 팔각 정보판 (동1국·점수 4방향이 올라갈 빈 판) | ★★ |
| 4-10 | `table-light.png` | 1400×1400 | PNG 투명 | 상단 조명 광선 오버레이 | ★ |

> 펠트는 **완전히 균일한 타일링 텍스처**로 (중앙 무늬 금지 — 중앙엔 정보판이 올라갑니다).
> 프롬프트: `seamless tileable fabric texture, fine woven wool felt, deep jade green, subtle fiber grain, evenly lit, flat, top-down, no pattern, no logo, no text`

---

## 5. 현판 · 프레임 · 버튼 (22장) — ★★

레퍼런스의 "게임같음"은 대부분 **현판·프레임**에서 나옵니다. 전부 **글자 없이** 빈 판으로 주세요.

### 5-A. 메뉴 현판 (로비 대문짝만한 버튼) — ★★★

| # | 파일명 | 크기 | 형식 | 내용 |
|---|---|---|---|---|
| 5-1 | `plaque-menu-1.png` | 1200×340 | PNG 투명 | **빠른 대전** — 남색 옻칠 + 금테 + 좌우 나무 마구리 + 홍색 매듭줄 |
| 5-2 | `plaque-menu-2.png` | 1200×340 | PNG 투명 | **친선방** — 나무결 + 청사초롱 2개 매달림 |
| 5-3 | `plaque-menu-3.png` | 1200×340 | PNG 투명 | **코드 참가** — 홍색 + 잉어/학 조각 장식 |
| 5-4 | `plaque-menu-4.png` | 1200×340 | PNG 투명 | **연습 대국** — 기와 회색 + 수막새 문양 |

> 프롬프트: `an empty traditional Korean wooden hanging signboard (hyeonpan), horizontal plaque, deep indigo lacquered panel with gold border and carved cloud pattern, wooden end caps on the left and right, red braided knot rope on top, **completely blank center with no writing**, front view, transparent background, (스타일 고정 문구)`

### 5-B. 패널·프레임 — ★★

| # | 파일명 | 크기 | 형식 | 내용 |
|---|---|---|---|---|
| 5-5 | `plaque-title.png` | 900×220 | PNG 투명 | 화면 제목 현판 (숙소·방 생성·저잣거리) |
| 5-6 | `panel-modal.png` | 1024×768 (9-slice) | PNG 투명 | 모달 창 — 남색 바탕 + 금테 + 네 모서리 장식 |
| 5-7 | `panel-corner.png` | 256×256 | PNG 투명 | 모서리 장식 낱개 (좌상단 1개만, 나머지는 미러링) |
| 5-8 | `panel-side.png` | 640×900 (9-slice) | PNG 투명 | 우측 사이드패널 (설정·역일람·기록) |
| 5-9 | `frame-avatar.png` | 256×256 | PNG 투명 | 좌석 아바타 테두리 (평상시) |
| 5-10 | `frame-avatar-active.png` | 256×256 | PNG 투명 | 좌석 아바타 테두리 (내 차례 — 금빛 발광) |
| 5-11 | `frame-card.png` | 400×560 | PNG 투명 | 캐릭터/상품 카드 프레임 (평상시) |
| 5-12 | `frame-card-selected.png` | 400×560 | PNG 투명 | 카드 프레임 (선택됨 — 청록 발광) |
| 5-13 | `nameplate.png` | 600×120 (9-slice) | PNG 투명 | 닉네임·칭호 명패 |
| 5-14 | `panel-dora.png` | 520×280 | PNG 투명 | 좌상단 도라 표시패 슬롯판 (5칸) |

### 5-C. 버튼·소품 — ★

| # | 파일명 | 크기 | 형식 | 내용 |
|---|---|---|---|---|
| 5-15 | `btn-option-off.png` | 400×120 (9-slice) | PNG 투명 | 옵션 버튼 (비선택, 어두운 남색) |
| 5-16 | `btn-option-on.png` | 400×120 (9-slice) | PNG 투명 | 옵션 버튼 (선택, 금빛) |
| 5-17 | `btn-cta.png` | 520×160 (9-slice) | PNG 투명 | 큰 확인/생성 버튼 |
| 5-18 | `btn-back.png` | 192×192 | PNG 투명 | 뒤로가기 (육각/여의주형 틀) |
| 5-19 | `tab-off.png` · `tab-on.png` | 320×110 | PNG 투명 | 탭 2종 (저잣거리 슬롯 탭) |
| 5-20 | `tag-inuse.png` | 200×280 | PNG 투명 | "사용중" 걸개 (세로 목패, 글자 없이) |
| 5-21 | `badge-limited.png` | 240×120 | PNG 투명 | "한정" 리본 배지 (글자 없이) |
| 5-22 | `divider.png` | 1600×24 | PNG 투명 | 가로 구분선 (가운데 문양 + 양끝 페이드) |

---

## 6. 아이콘 (25종) — ★★

**전부 같은 통일된 스타일**로. 레퍼런스처럼 "작은 삽화" 느낌(원형/능형 배지 안에 소재).
크기 **256×256, PNG 투명**, 파일명은 아래 그대로.

### 6-A. 로비 하단 네비 (6종) — ★★

| 파일명 | 소재 (한국판) |
|---|---|
| `icon-nav-shop.png` | **저잣거리** — 차양 친 좌판, 엽전 꾸러미 |
| `icon-nav-quarters.png` | **숙소** — 솟을대문 |
| `icon-nav-record.png` | **전적** — 한지 두루마리 + 붓 |
| `icon-nav-friend.png` | **벗** — 두 개의 노리개 매듭 |
| `icon-nav-rules.png` | **규칙** — 펼친 한장본 고서 |
| `icon-nav-wish.png` | **기원** — 해태 석상 (레퍼런스 마네키네코 자리) |

### 6-B. 로비 우측 원형 버튼 (5종) — ★

`icon-settings.png` (톱니 대신 **수레바퀴 문양**) · `icon-help.png` (물음표 대신 **부적**) ·
`icon-mail.png` (**서찰 봉투**) · `icon-codex.png` (**도감·책갑**) · `icon-sound.png` (**풍경(風磬)**)

### 6-C. 재화·수치 (4종) — ★★

`icon-yeopjeon.png` (**엽전** — 가운데 네모 구멍, 로비 잔액바용 ★★★) ·
`icon-plus.png` (충전 + 버튼 틀) ·
`icon-riichi-stick.png` (**리치봉** — 1000점봉, 흰 막대 + 붉은 점) ·
`icon-point-stick.png` (점수봉)

### 6-D. 대국 화면 HUD (4종) — ★

`icon-game-settings.png` · `icon-game-exit.png` · `icon-game-emote.png` (탈 실루엣) · `icon-game-sync.png`

### 6-E. 방 생성 행 아이콘 (4종) — ★

`icon-opt-mode.png` (마작패 1장) · `icon-opt-length.png` (東/南 방위 나침반) ·
`icon-opt-time.png` (**해시계**) · `icon-opt-advanced.png` (수레바퀴)

### 6-F. 배지 (2종) — ★

`badge-dot.png` (붉은 알림점) · `badge-up.png` (상승 표식)

---

## 7. 연출 이펙트 (14장) — ★★

| # | 파일명 | 크기 | 형식 | 내용 | ★ |
|---|---|---|---|---|---|
| 7-1~6 | `fx-call-<pon\|chi\|kan\|riichi\|ron\|tsumo>.png` | 각 800×800 | PNG 투명 | **콜 도장 6종** — 붉은 전각 도장 안에 붓글씨(퐁/치/깡/리치/론/쯔모). **이건 글자 들어가도 됩니다** | ★★ |
| 7-7 | `fx-byeongpung.png` | 2400×1400 | PNG 투명 | **병풍 3폭** — 만관 이상 화료 시 뒤로 펼쳐지는 산수 병풍 | ★★ |
| 7-8 | `fx-gold-flake.png` | 128×128 | PNG 투명 | 금박 조각 낱개 (역만 파티클) | ★ |
| 7-9~11 | `fx-petal-<1\|2\|3>.png` | 각 128×128 | PNG 투명 | 꽃잎 3종 (매화·벚꽃·살구) | ★ |
| 7-12 | `fx-brush-underline.png` | 600×80 | PNG 투명 | 야쿠 이름 밑 붓획 | ★ |
| 7-13 | `fx-han-circle.png` | 400×400 | PNG 투명 | 판수 먹동그라미 (붓으로 그린 원) | ★ |
| 7-14 | `fx-light-ray.png` | 1600×900 | PNG 투명 | 사선 광선 오버레이 | ★ |

---

## 8. 이모티콘 — 탈 (6종) — ★

저잣거리 이모티콘 상품. **256×256 PNG 투명**, 한국 전통 탈.

`emote-hahoe.png` (하회 양반탈) · `emote-gaksi.png` (각시탈) · `emote-choraengi.png` (초랭이탈) ·
`emote-bune.png` (부네탈) · `emote-imae.png` (이매탈) · `emote-baekjeong.png` (백정탈)

> 각각 **표정이 확실히 다르게** — 웃음 / 찡그림 / 놀람 / 능청 / 슬픔 / 화남.

---

## 9. 로고 · 브랜딩 (5장) — ★★

| # | 파일명 | 크기 | 형식 | 내용 |
|---|---|---|---|---|
| 9-1 | `logo-emblem.png` | 1024×1024 | PNG 투명 | 원형 엠블럼 — 수막새 테두리 안에 기와 지붕 실루엣 (레퍼런스 좌상단 원형 로고 자리) |
| 9-2 | `logo-wordmark.png` | 1600×500 | PNG 투명 | 「청기와」 붓글씨 워드마크 (**이건 글자 필수**) |
| 9-3 | `favicon.png` | 512×512 | PNG | 브라우저 탭 아이콘 (엠블럼 단순화판) |
| 9-4 | `og-image.jpg` | 1200×630 | JPG | 링크 공유 썸네일 |
| 9-5 | `icon-512.png` | 512×512 | PNG | PWA 홈화면 아이콘 |

---

## 10. 이미지가 필요 **없는** 것 (제가 코드로 만듭니다)

생성 노력을 아끼시라고 명시합니다. 아래는 SVG/CSS로 이미 잘 나오고 있습니다.

- **폰트** — Noto Serif KR · Pretendard 로컬 서브셋 번들 완료 (OFL)
- **효과음 전부** — Web Audio 합성 (타패·쯔모·울기·리치·화료·역만). 음원 파일 불필요
- **한지·창호·나무 질감** — CSS 패턴
- **단청 띠·수막새·엽전·처마 곡선·조각보 로딩** — SVG 원본
- **마작패 앞면 34종** — SVG (§3은 "더 예쁘게 하고 싶으면" 옵션)
- **밤하늘·달·별·능선** — 배경 원화 오면 전부 교체될 임시 벡터
- **점수 카운트업·타이머 링·토글·슬라이더·진행바** — 코드
- **텍스트 전부** — 제목·버튼 문구·수치·야쿠 이름·닉네임

---

## 11. 총계 및 투입 순서

| 단계 | 장수 | 내용 | 효과 |
|---|---|---|---|
| **1단계** | **12장** | 배경 5 (1-1·1-3·1-4·1-5·1-6) + 캐릭터 1명 3장 (2-a·2-b·2-c) + 메뉴 현판 4장 (5-1~4) | **여기서 이미 레퍼런스 인상이 납니다** |
| 2단계 | +16장 | 아이콘 6-A(6) + 6-C(4) + 프레임 5-5·5-6·5-9·5-10·5-13·5-14 | 화면이 "게임"이 됨 |
| 3단계 | +20장 | 콜 도장 6 + 병풍 1 + 마작상 펠트 4 + 캐릭터 2명 추가 8(전신·반신) + table-center | 연출 완성 |
| 4단계 | +나머지 | 패 스프라이트 · 탈 6 · 잔여 아이콘·버튼 · 로고 5 | 마감 |
| **전체** | **약 140장** | (캐릭터 4명 기준) | |

### 투입 방법

1. 이 폴더(`apps/client/assets/handoff/`)에 **표의 파일명 그대로** 넣기
2. "넣었어요" 한 마디만 주시면 됩니다
3. 제가 하는 일: 톤 보정 → 크롭·세이프존 검증 → WebP 변환·리사이즈(1x/2x) → 슬롯 연결 →
   그 위에 코드 연출(글자·애니메이션·상태) 얹기 → 실브라우저 확인 → `ATTRIBUTIONS.md` 기록

### 부분 투입도 됩니다

한 번에 다 안 주셔도 됩니다. **1장씩 오는 대로** 그 슬롯만 교체하고 나머지는 벡터로 유지합니다.
파일명만 맞으면 됩니다.
