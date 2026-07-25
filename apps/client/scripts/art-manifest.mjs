/**
 * 원화 에셋 생성 매니페스트 (assets/handoff/README.md 와 1:1 대응).
 *
 * gen: 이미지 API에 요청할 크기 — 1024x1024 | 1536x1024 | 1024x1536 만 지원된다.
 * out: 후처리(크롭·업스케일) 후 최종 저장 크기. 생략하면 gen 그대로 저장.
 * alpha: true면 투명 배경 PNG로 요청.
 * stage: 투입 단계 (1이 가장 급함).
 */

/** 모든 프롬프트 끝에 붙는 스타일 고정 문구 — 한 게임처럼 보이게 하는 핵심 */
export const STYLE =
  'painterly anime game art, soft cel shading, elegant Korean traditional aesthetic, ' +
  'dancheong color palette of deep indigo vermilion red jade green and gold leaf, ' +
  'grey curved Korean giwa roof tiles, high detail, ' +
  'no text, no watermark, no UI, no letters, no signature';

/** 배경 공통 — 인물 금지 */
const BG = 'digital painting, anime game background art, wide cinematic composition, no people, no characters';

const bg = (id, file, prompt, stage = 1) => ({
  id,
  file,
  group: '배경',
  stage,
  gen: '1536x1024',
  out: [2560, 1440],
  alpha: false,
  format: 'jpeg',
  prompt: `${BG}, ${prompt}, ${STYLE}`,
});

const backgrounds = [
  bg(
    'bg-lobby',
    'bg-lobby.jpg',
    'traditional Korean royal palace garden in spring, hanok pavilion with grey curved giwa tiled roof and blue-green dancheong painted eaves, plum and cherry blossoms in full bloom, distant misty mountains, stone path, stone lantern, small arched stone bridge over a clear pond, warm late-afternoon light, pink and lavender petals drifting in the air, open sky in the upper area, deliberately empty and low-detail on the right 40 percent and the lower left corner',
  ),
  bg(
    'bg-room',
    'bg-room.jpg',
    'Korean palace courtyard seen from a low angle looking up at the main gate, hongsalmun red spiked gate, flagstone courtyard, blossom trees framing both sides, softer and slightly darker overall so interface panels read on top',
  ),
  bg(
    'bg-quarters',
    'bg-quarters.jpg',
    'interior of a traditional Korean hanok room at night, daecheong wooden floor, changhoji paper sliding doors with moonlight behind them, low lacquered table, cheongsachorong blue and red silk lanterns glowing warm, folding screen with an ink landscape painting, cozy and dim, deliberately empty space on the left half of the frame',
  ),
  bg(
    'bg-hall',
    'bg-hall.jpg',
    'dark interior of a Korean hanok hall seen from a seated viewpoint, thick wooden pillars on the far left and far right edges only, changhoji paper doors, a single warm light source from above, the entire center of the frame is dark empty and out of focus, deep indigo and warm brown, heavy vignette, no furniture in the center',
  ),
  bg(
    'bg-result',
    'bg-result.jpg',
    'abstract deep indigo background, large soft plum blossom silhouettes, diagonal light rays from the upper left, subtle drifting gold dust, dark and calm so bright interface text reads clearly, minimal',
  ),
  bg(
    'bg-lobby-night',
    'bg-lobby-night.jpg',
    'traditional Korean royal palace garden at night, hanok pavilion with grey curved giwa roof, deep indigo sky with a large full moon, cheongsachorong silk lanterns glowing warm along the eaves, fireflies, moonlight reflecting on the pond, plum blossoms, deliberately empty on the right 40 percent and the lower left',
    4,
  ),
  bg(
    'bg-loading',
    'bg-loading.jpg',
    'a single Korean roof-end tile medallion motif centered on a deep indigo ink-wash background, minimal, elegant',
    4,
  ),
];

// ── 캐릭터 ────────────────────────────────────────────────────────────

const CHARACTERS = [
  {
    id: 'dan',
    stage: 1,
    look: 'a young Korean woman wearing an elegant hanbok, short crimson jeogori jacket with wide sleeves and a long flowing navy chima skirt, norigae ornament pendant at the waist, long braided black hair with a red daenggi ribbon, holding a closed folding fan, calm confident expression',
  },
  {
    id: 'mae',
    stage: 3,
    look: 'a lively Korean girl wearing a pale pink jeogori and jade green chima hanbok, plum blossom hairpin, two short braids, bright cheerful smile, butterflies around her',
  },
  {
    id: 'seol',
    stage: 3,
    look: 'a composed young Korean scholar wearing a white dopo robe and a black gat hat, holding an ink brush and a rolled scroll, cool detached expression',
  },
  {
    id: 'ru',
    stage: 4,
    look: 'a mischievous Korean fantasy figure wearing a dark indigo cheollik robe, small dokkaebi horns, obangsaek five-color knot bells at the belt, sly grin',
  },
];

const characters = CHARACTERS.flatMap((c) => [
  {
    id: `char-${c.id}-full`,
    file: `char-${c.id}-full.png`,
    group: '캐릭터',
    stage: c.stage,
    gen: '1024x1536',
    out: [1600, 2400],
    alpha: true,
    format: 'png',
    prompt: `original character concept art, full body anime illustration, ${c.look}, standing pose facing slightly to the side, full body visible from head to toe with the feet included, centered in frame, detailed embroidered fabric patterns, ${STYLE}, original design, transparent background`,
  },
  {
    id: `char-${c.id}-bust`,
    file: `char-${c.id}-bust.png`,
    group: '캐릭터',
    stage: c.stage,
    gen: '1024x1024',
    alpha: true,
    format: 'png',
    /** 전신을 레퍼런스로 넣어 같은 인물을 유지한다 */
    ref: `char-${c.id}-full.png`,
    prompt: `the same character, bust shot from the chest up, facing the viewer, centered, calm expression, ${STYLE}, transparent background`,
  },
  {
    id: `char-${c.id}-sd`,
    file: `char-${c.id}-sd.png`,
    group: '캐릭터',
    stage: c.stage === 1 ? 1 : 4,
    gen: '1024x1024',
    alpha: true,
    format: 'png',
    ref: `char-${c.id}-full.png`,
    prompt: `the same character redrawn as a chibi super deformed two-head-tall version, cute, simplified, standing, full body, ${STYLE}, transparent background`,
  },
  {
    id: `char-${c.id}-cutin`,
    file: `char-${c.id}-cutin.png`,
    group: '캐릭터',
    stage: 4,
    gen: '1024x1024',
    alpha: true,
    format: 'png',
    ref: `char-${c.id}-full.png`,
    prompt: `the same character, upper body dynamic pose, dramatic rim lighting, confident expression, motion in the hair and sleeves, ${STYLE}, transparent background`,
  },
]);

// ── 현판 · 프레임 · 버튼 ──────────────────────────────────────────────

const ui = (id, file, prompt, opts = {}) => ({
  id,
  file,
  group: 'UI',
  stage: opts.stage ?? 2,
  gen: opts.gen ?? '1024x1024',
  out: opts.out,
  alpha: true,
  format: 'png',
  prompt: `${prompt}, front view, isolated object, centered, ${STYLE}, transparent background`,
});

const PLAQUE = 'an empty traditional Korean wooden hanging signboard called hyeonpan, horizontal plaque, completely blank center with absolutely no writing carved or painted on it';

const uiParts = [
  ui('plaque-menu-1', 'plaque-menu-1.png', `${PLAQUE}, deep indigo lacquered panel with a gold border and carved cloud pattern, wooden end caps on the left and right, red braided knot rope hanging from the top`, { gen: '1536x1024', out: [1200, 340], stage: 1 }),
  ui('plaque-menu-2', 'plaque-menu-2.png', `${PLAQUE}, warm wood grain panel with a jade green border, two small cheongsachorong silk lanterns hanging from the left and right ends`, { gen: '1536x1024', out: [1200, 340], stage: 1 }),
  ui('plaque-menu-3', 'plaque-menu-3.png', `${PLAQUE}, vermilion red lacquered panel with gold trim, carved carp and crane ornaments at both ends`, { gen: '1536x1024', out: [1200, 340], stage: 1 }),
  ui('plaque-menu-4', 'plaque-menu-4.png', `${PLAQUE}, slate grey roof-tile coloured panel with a repeating lotus roof-end medallion pattern along the border`, { gen: '1536x1024', out: [1200, 340], stage: 1 }),
  ui('plaque-title', 'plaque-title.png', `${PLAQUE}, smaller and simpler, dark wood with a thin gold rim and a small knot tassel`, { gen: '1536x1024', out: [900, 220] }),
  ui('panel-modal', 'panel-modal.png', 'an empty rectangular dialog panel in Korean traditional style, deep indigo lacquer surface, thin gold border, carved ornament at each of the four corners, completely blank interior', { gen: '1536x1024', out: [1024, 768] }),
  ui('panel-corner', 'panel-corner.png', 'a single Korean carved gilt corner ornament for a panel frame, scrollwork and lotus motif, upper-left orientation', { out: [256, 256], stage: 3 }),
  ui('panel-side', 'panel-side.png', 'an empty tall vertical side panel in Korean traditional style, deep indigo lacquer, thin gold border, folding screen proportions, completely blank interior', { gen: '1024x1536', out: [640, 900], stage: 3 }),
  ui('frame-avatar', 'frame-avatar.png', 'an empty square portrait frame in Korean traditional style, dark wood with a thin gold inlay border and small lotus corner studs, hollow center', { out: [256, 256] }),
  ui('frame-avatar-active', 'frame-avatar-active.png', 'an empty square portrait frame in Korean traditional style, dark wood with a bright glowing gold inlay border, radiant golden light emanating from the frame, hollow center', { out: [256, 256] }),
  ui('frame-card', 'frame-card.png', 'an empty vertical card frame in Korean traditional style, dark lacquer with a thin gold rim and a small knot ornament at the top, hollow center', { gen: '1024x1536', out: [400, 560], stage: 3 }),
  ui('frame-card-selected', 'frame-card-selected.png', 'an empty vertical card frame in Korean traditional style, dark lacquer with a glowing jade green rim, radiant light along the border, hollow center', { gen: '1024x1536', out: [400, 560], stage: 3 }),
  ui('nameplate', 'nameplate.png', 'an empty narrow horizontal nameplate in Korean traditional style, dark wood with a thin gold edge and tapered ends, completely blank', { gen: '1536x1024', out: [600, 120] }),
  ui('panel-dora', 'panel-dora.png', 'an empty horizontal slot tray holding five blank rectangular card-sized recesses, Korean traditional dark lacquer and gold trim, viewed straight on', { gen: '1536x1024', out: [520, 280] }),
  ui('btn-option-off', 'btn-option-off.png', 'an empty rounded rectangular button, dark indigo lacquer with a subtle grey-blue rim, matte, completely blank face', { gen: '1536x1024', out: [400, 120], stage: 3 }),
  ui('btn-option-on', 'btn-option-on.png', 'an empty rounded rectangular button, warm gold lacquer with a bright rim and a soft glow, completely blank face', { gen: '1536x1024', out: [400, 120], stage: 3 }),
  ui('btn-cta', 'btn-cta.png', 'an empty wide rounded button in Korean traditional style, vermilion lacquer with gold trim and a small cloud pattern at both ends, completely blank face', { gen: '1536x1024', out: [520, 160], stage: 3 }),
  ui('btn-back', 'btn-back.png', 'a hexagonal Korean traditional button plate with a gilt border and a carved swirl, blank center', { out: [192, 192], stage: 3 }),
  ui('tab-off', 'tab-off.png', 'an empty tab shaped panel with the top corners rounded, dark indigo wood, blank face', { gen: '1536x1024', out: [320, 110], stage: 4 }),
  ui('tab-on', 'tab-on.png', 'an empty tab shaped panel with the top corners rounded, warm lit wood with a gold top edge, blank face', { gen: '1536x1024', out: [320, 110], stage: 4 }),
  ui('tag-inuse', 'tag-inuse.png', 'a small vertical wooden hanging tag on a red cord, Korean traditional, dark wood with a gold rim, completely blank face', { gen: '1024x1536', out: [200, 280], stage: 4 }),
  ui('badge-limited', 'badge-limited.png', 'a small folded ribbon badge in vermilion and gold, Korean traditional knot styling, completely blank face', { gen: '1536x1024', out: [240, 120], stage: 4 }),
  ui('divider', 'divider.png', 'a thin horizontal ornamental divider line, gold, with a small lotus medallion at the center and both ends fading out', { gen: '1536x1024', out: [1600, 24], stage: 4 }),
];

// ── 아이콘 ────────────────────────────────────────────────────────────

const ICON_STYLE =
  'a single game interface icon, small illustrated scene inside a round Korean lacquer badge with a thin gold rim, clean silhouette, readable at small size, centered';

const icon = (id, subject, stage = 2) => ({
  id,
  file: `${id}.png`,
  group: '아이콘',
  stage,
  gen: '1024x1024',
  out: [256, 256],
  alpha: true,
  format: 'png',
  prompt: `${ICON_STYLE}, ${subject}, ${STYLE}, transparent background`,
});

const icons = [
  icon('icon-nav-shop', 'a Korean market stall with a cloth awning and a string of coins'),
  icon('icon-nav-quarters', 'a Korean solmun raised gate of a hanok house'),
  icon('icon-nav-record', 'a rolled hanji paper scroll with an ink brush laid across it'),
  icon('icon-nav-friend', 'two interlocking Korean norigae decorative knots'),
  icon('icon-nav-rules', 'an open traditional Korean thread-bound book'),
  icon('icon-nav-wish', 'a haetae guardian lion stone statue'),
  icon('icon-yeopjeon', 'a single Korean brass yeopjeon coin with a square hole in the center, three-quarter view', 1),
  icon('icon-plus', 'a plus sign carved on a small round gold plate', 2),
  icon('icon-riichi-stick', 'a slim white betting stick with a single red dot at the center, lying diagonally', 2),
  icon('icon-point-stick', 'a slim white scoring stick with three small red dots, lying diagonally', 3),
  icon('icon-settings', 'an ornate Korean wooden cart wheel seen face on', 3),
  icon('icon-help', 'a Korean bujeok paper talisman with a red seal', 3),
  icon('icon-mail', 'a folded Korean hanji letter sealed with a red wax stamp', 3),
  icon('icon-codex', 'a Korean book case holding several thread-bound volumes', 4),
  icon('icon-sound', 'a Korean temple wind chime with a fish shaped clapper', 4),
  icon('icon-game-settings', 'an ornate Korean wooden cart wheel seen face on, simplified', 3),
  icon('icon-game-exit', 'an open Korean gate with a doorway of light beyond it', 3),
  icon('icon-game-emote', 'a Korean hahoe wooden mask front view', 3),
  icon('icon-game-sync', 'two curved arrows forming a taegeuk-like circle', 4),
  icon('icon-opt-mode', 'a single mahjong tile standing upright, blank face', 4),
  icon('icon-opt-length', 'a Korean compass rose plate showing the four cardinal directions', 4),
  icon('icon-opt-time', 'a Korean stone sundial', 4),
  icon('icon-opt-advanced', 'an ornate gear shaped like a lotus medallion', 4),
  icon('badge-dot', 'a small glowing vermilion red dot with a soft halo, nothing else', 4),
  icon('badge-up', 'a small gold upward chevron on a round plate', 4),
];

// ── 마작상 ────────────────────────────────────────────────────────────

const FELT = 'seamless tileable fabric texture, fine woven wool felt, subtle fiber grain, evenly lit, flat, top down view, no pattern, no logo, no text, no watermark';

const felt = (id, colour) => ({
  id: `table-felt-${id}`,
  file: `table-felt-${id}.jpg`,
  group: '마작상',
  stage: 3,
  gen: '1024x1024',
  out: [1400, 1400],
  alpha: false,
  format: 'jpeg',
  prompt: `${FELT}, ${colour}`,
});

const tables = [
  felt('noirok', 'deep jade green'),
  felt('jjokbit', 'deep indigo blue'),
  felt('meok', 'charcoal ink black'),
  felt('jadan', 'dark rosewood red brown'),
  {
    id: 'table-center',
    file: 'table-center.png',
    group: '마작상',
    stage: 3,
    gen: '1024x1024',
    out: [512, 512],
    alpha: true,
    format: 'png',
    prompt: `an empty octagonal information plate for a game board, dark lacquer with a gold rim and a small carved lotus at the center, completely blank face with no writing, top down view, ${STYLE}, transparent background`,
  },
  {
    id: 'table-light',
    file: 'table-light.png',
    group: '마작상',
    stage: 4,
    gen: '1024x1024',
    out: [1400, 1400],
    alpha: true,
    format: 'png',
    prompt: 'a soft warm overhead light pool falling on a surface, radial glow fading to nothing at the edges, subtle dust motes, no objects, transparent background',
  },
];

// ── 패 뒷면 ──────────────────────────────────────────────────────────

const backs = [
  ['sumaksae', 'a gold lotus roof-end tile medallion on a deep indigo lacquer ground'],
  ['yeonhwa', 'a layered gold lotus flower on a deep plum wine lacquer ground'],
  ['dokkaebi', 'a gold Korean dokkaebi goblin face roof tile motif on a dark green lacquer ground'],
  ['taegeuk', 'a three-part sam-taegeuk swirl in red blue and gold on a charcoal lacquer ground'],
].map(([id, art]) => ({
  id: `tile-back-${id}`,
  file: `tile-back-${id}.png`,
  group: '패 뒷면',
  stage: 4,
  gen: '1024x1024',
  out: [256, 342],
  alpha: true,
  format: 'png',
  prompt: `the back face of a single mahjong tile viewed straight on, rounded rectangle, ${art}, thin gold border inset, ${STYLE}, transparent background`,
}));

// ── 연출 이펙트 ──────────────────────────────────────────────────────

const CALLS = [
  ['pon', '퐁'],
  ['chi', '치'],
  ['kan', '깡'],
  ['riichi', '리치'],
  ['ron', '론'],
  ['tsumo', '쯔모'],
];

const fx = [
  ...CALLS.map(([id, ko]) => ({
    id: `fx-call-${id}`,
    file: `fx-call-${id}.png`,
    group: '연출',
    stage: 3,
    gen: '1024x1024',
    out: [800, 800],
    alpha: true,
    format: 'png',
    /** 도장은 글자가 들어가야 하므로 STYLE의 no-text 를 쓰지 않는다 */
    prompt: `a traditional Korean carved seal stamp impression in vermilion red ink, square seal outline, the Korean word "${ko}" written inside in bold brush calligraphy, rough ink texture with slight bleed, isolated, centered, transparent background, no other text, no watermark`,
  })),
  {
    id: 'fx-byeongpung',
    file: 'fx-byeongpung.png',
    group: '연출',
    stage: 3,
    gen: '1536x1024',
    out: [2400, 1400],
    alpha: true,
    format: 'png',
    prompt: `a three panel Korean folding screen standing open, ink wash landscape of mountains and a moon painted across the panels, gold leaf accents, viewed straight on, isolated, ${STYLE}, transparent background`,
  },
  {
    id: 'fx-gold-flake',
    file: 'fx-gold-flake.png',
    group: '연출',
    stage: 4,
    gen: '1024x1024',
    out: [128, 128],
    alpha: true,
    format: 'png',
    prompt: 'a single small irregular flake of gold leaf, glinting, isolated, centered, transparent background, no text',
  },
  ...['plum', 'cherry', 'apricot'].map((f, i) => ({
    id: `fx-petal-${i + 1}`,
    file: `fx-petal-${i + 1}.png`,
    group: '연출',
    stage: 4,
    gen: '1024x1024',
    out: [128, 128],
    alpha: true,
    format: 'png',
    prompt: `a single ${f} blossom petal, soft pink, isolated, centered, transparent background, no text`,
  })),
  {
    id: 'fx-brush-underline',
    file: 'fx-brush-underline.png',
    group: '연출',
    stage: 4,
    gen: '1536x1024',
    out: [600, 80],
    alpha: true,
    format: 'png',
    prompt: 'a single horizontal brush stroke in black ink, tapering at both ends, dry brush texture, isolated, transparent background, no text',
  },
  {
    id: 'fx-han-circle',
    file: 'fx-han-circle.png',
    group: '연출',
    stage: 4,
    gen: '1024x1024',
    out: [400, 400],
    alpha: true,
    format: 'png',
    prompt: 'a single circle drawn with one sweep of a black ink brush, ensō style with a small gap, rough edges, isolated, centered, transparent background, no text',
  },
  {
    id: 'fx-light-ray',
    file: 'fx-light-ray.png',
    group: '연출',
    stage: 4,
    gen: '1536x1024',
    out: [1600, 900],
    alpha: true,
    format: 'png',
    prompt: 'soft diagonal god rays of warm light falling from the upper left, volumetric, fading out, nothing else in frame, transparent background, no text',
  },
];

// ── 탈 이모티콘 ──────────────────────────────────────────────────────

const emotes = [
  ['hahoe', 'a Korean hahoe yangban nobleman mask, hearty laughing expression'],
  ['gaksi', 'a Korean gaksi bride mask, pale face with red cheek dots, shy downcast expression'],
  ['choraengi', 'a Korean choraengi servant mask, crooked mischievous grin'],
  ['bune', 'a Korean bune mask, coy sidelong smile'],
  ['imae', 'a Korean imae fool mask, chinless sad drooping expression'],
  ['baekjeong', 'a Korean baekjeong butcher mask, fierce angry glare'],
].map(([id, look]) => ({
  id: `emote-${id}`,
  file: `emote-${id}.png`,
  group: '이모티콘',
  stage: 4,
  gen: '1024x1024',
  out: [256, 256],
  alpha: true,
  format: 'png',
  prompt: `a single traditional Korean wooden mask, front view, ${look}, carved wood with painted finish, isolated, centered, ${STYLE}, transparent background`,
}));

// ── 로고 ─────────────────────────────────────────────────────────────

const logos = [
  {
    id: 'logo-emblem',
    file: 'logo-emblem.png',
    group: '로고',
    stage: 4,
    gen: '1024x1024',
    out: [1024, 1024],
    alpha: true,
    format: 'png',
    prompt: `a circular game emblem, a Korean lotus roof-end tile medallion forming the outer ring, a silhouette of a curved giwa tiled roof inside it, gold on deep indigo, ${STYLE}, transparent background`,
  },
  {
    id: 'og-image',
    file: 'og-image.jpg',
    group: '로고',
    stage: 4,
    gen: '1536x1024',
    out: [1200, 630],
    alpha: false,
    format: 'jpeg',
    prompt: `${BG}, a Korean palace roof at dusk with mahjong tiles resting on a jade felt surface in the foreground, moody and elegant, ${STYLE}`,
  },
];

export const MANIFEST = [
  ...backgrounds,
  ...characters,
  ...uiParts,
  ...icons,
  ...tables,
  ...backs,
  ...fx,
  ...emotes,
  ...logos,
];
