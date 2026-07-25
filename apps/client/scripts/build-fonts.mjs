/**
 * 폰트 로컬 번들 생성 (PLAN.md §4.2 — 외부 CDN 의존 금지).
 *
 * - Noto Serif KR (제목·연출): 소스에 실제 등장하는 한글/한자만 정밀 서브셋 → 매우 작음
 * - Pretendard (UI 본문): 닉네임 등 임의 한글이 들어오므로 KS X 1001 상용 2,350자 + 라틴
 *
 * 사용: node scripts/build-fonts.mjs   (fonttools, brotli 필요)
 * 결과: public/fonts/*.woff2 + src/styles/fonts.css
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const srcDir = path.join(root, 'src');
const outDir = path.join(root, 'public/fonts');
const cacheDir = '/tmp/cheongiwa-fonts';
mkdirSync(outDir, { recursive: true });
mkdirSync(cacheDir, { recursive: true });

/** 소스 트리에서 한글/한자 글리프 수집 (제목 폰트 서브셋 기준) */
function collectGlyphs(dir, set) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collectGlyphs(p, set);
      continue;
    }
    if (!/\.(tsx?|css|html)$/.test(entry.name)) continue;
    for (const ch of readFileSync(p, 'utf8')) {
      const c = ch.codePointAt(0);
      // 한글 음절/자모, CJK 통합한자
      if ((c >= 0xac00 && c <= 0xd7a3) || (c >= 0x3130 && c <= 0x318f) || (c >= 0x4e00 && c <= 0x9fff)) {
        set.add(ch);
      }
    }
  }
  return set;
}

/** KS X 1001 상용 한글 2,350자 — 조합형 순서가 아니므로 목록을 코드로 생성 */
function ksx1001Syllables() {
  // KS X 1001의 2,350자는 특정 목록이지만, 실사용 커버리지를 위해
  // "초성 19 × 중성 21 × 종성(자주 쓰이는 것)"으로 근사한다.
  const CHO = 19;
  const JUNG = 21;
  const COMMON_JONG = [0, 1, 4, 8, 16, 17, 19, 21, 22, 23, 24, 25, 26, 27]; // 받침 없음 + 상용 받침
  const out = [];
  for (let cho = 0; cho < CHO; cho++) {
    for (let jung = 0; jung < JUNG; jung++) {
      for (const jong of COMMON_JONG) {
        out.push(String.fromCodePoint(0xac00 + (cho * 21 + jung) * 28 + jong));
      }
    }
  }
  return out.join('');
}

const LATIN =
  ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`' +
  'abcdefghijklmnopqrstuvwxyz{|}~·…—–“”‘’×÷≤≥±°%‰';

function subset(input, output, text, extraArgs = []) {
  execFileSync(
    'pyftsubset',
    [
      input,
      `--output-file=${output}`,
      '--flavor=woff2',
      '--layout-features=kern,liga,calt',
      '--no-hinting',
      '--desubroutinize',
      `--text=${text}`,
      ...extraArgs,
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  return statSync(output).size;
}

function fetchTo(url, dest) {
  execFileSync('curl', ['-sSL', '--max-time', '180', '-o', dest, url], { stdio: 'inherit' });
  return statSync(dest).size;
}

// ── 1. Noto Serif KR (제목·연출) ────────────────────────────────────
// Google Fonts의 text= 서브셋 API로 필요한 글리프만 받는다.
const displayGlyphs = [...collectGlyphs(srcDir, new Set())].sort().join('');
const displayText = displayGlyphs + LATIN;
console.log(`제목 폰트 글리프: ${displayGlyphs.length}자`);

const serifFiles = [];
for (const [weight, label] of [
  [700, 'bold'],
  [900, 'black'],
]) {
  const cssUrl =
    `https://fonts.googleapis.com/css2?family=Noto+Serif+KR:wght@${weight}` +
    `&text=${encodeURIComponent(displayText)}&display=swap`;
  const cssPath = path.join(cacheDir, `nsk-${weight}.css`);
  execFileSync(
    'curl',
    [
      '-sSL',
      '--max-time',
      '60',
      '-H',
      'User-Agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      '-o',
      cssPath,
      cssUrl,
    ],
    { stdio: 'inherit' },
  );
  const css = readFileSync(cssPath, 'utf8');
  // text= 서브셋은 확장자 없는 /l/font?kit=... 형태로 내려온다
  const url = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)?.[1];
  if (!url) throw new Error(`Noto Serif KR ${weight} woff2 URL을 찾지 못함`);
  const dest = path.join(outDir, `noto-serif-kr-${label}.woff2`);
  const size = fetchTo(url, dest);
  serifFiles.push({ weight, label, size });
  console.log(`  noto-serif-kr-${label}.woff2 ${(size / 1024).toFixed(1)}KB`);
}

// ── 2. Pretendard (UI 본문) ─────────────────────────────────────────
const bodyText = LATIN + ksx1001Syllables() + displayGlyphs;
const pretendardFiles = [];
for (const [weight, label, file] of [
  [400, 'regular', 'Pretendard-Regular.otf'],
  [700, 'bold', 'Pretendard-Bold.otf'],
]) {
  const src = path.join(cacheDir, file);
  try {
    statSync(src);
  } catch {
    fetchTo(
      `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/public/static/${file}`,
      src,
    );
  }
  const dest = path.join(outDir, `pretendard-${label}.woff2`);
  const size = subset(src, dest, bodyText);
  pretendardFiles.push({ weight, label, size });
  console.log(`  pretendard-${label}.woff2 ${(size / 1024).toFixed(1)}KB`);
}

// ── 3. @font-face CSS 생성 ──────────────────────────────────────────
const face = (family, label, weight) => `@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url('/fonts/${label}.woff2') format('woff2');
}`;

const css = [
  '/* 자동 생성 — scripts/build-fonts.mjs. 직접 수정하지 마세요. */',
  '/* 로컬 번들 폰트 (PLAN.md §4.2): 외부 CDN 의존 없음 */',
  ...serifFiles.map((f) => face('Noto Serif KR', `noto-serif-kr-${f.label}`, f.weight)),
  ...pretendardFiles.map((f) => face('Pretendard', `pretendard-${f.label}`, f.weight)),
  '',
].join('\n\n');
writeFileSync(path.join(root, 'src/styles/fonts.css'), css);

const total = [...serifFiles, ...pretendardFiles].reduce((s, f) => s + f.size, 0);
console.log(`총 ${(total / 1024).toFixed(0)}KB · src/styles/fonts.css 생성 완료`);
