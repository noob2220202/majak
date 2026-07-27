#!/usr/bin/env node
/**
 * 원화 → 게임 에셋 파이프라인.
 *
 *   node scripts/build-art.mjs
 *   node scripts/build-art.mjs --only badge-tier   # 이름에 이 말이 든 것만 (한 장 고칠 때)
 *
 * assets/handoff/*.{png,jpg} 를 읽어 public/art/*.webp 로 굽는다.
 * - 투명 에셋은 빈 여백을 잘라낸다(trim). 원화는 대상이 프레임 가운데 작게 놓이는 일이
 *   많은데, 여백째 배치하면 CSS로 위치를 잡을 수 없기 때문이다.
 * - 표시 크기보다 큰 것만 줄인다. 확대는 하지 않는다 — 없는 디테일이 생기지 않고
 *   용량만 커진다. 브라우저가 알아서 늘려 그리는 편이 낫다.
 * - 전부 WebP. 투명이 필요한 것은 알파를 유지한다.
 * - 예외로 공유 미리보기(og-image)만 JPEG 도 같이 굽는다. 카카오톡·라인 같은
 *   메신저 크롤러 중에 WebP 를 아직 안 읽는 것이 있어, 링크를 붙였을 때
 *   그림이 통째로 안 뜨는 것보다 한 장 더 굽는 편이 싸다.
 */

import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const SRC = fileURLToPath(new URL('../assets/handoff/', import.meta.url));
const DEST = fileURLToPath(new URL('../public/art/', import.meta.url));

/**
 * 파일별 처리 규칙.
 * trim  — 투명 여백 잘라내기
 * max   — 긴 변 최대 길이(px). 원본이 이보다 작으면 그대로 둔다
 * q     — WebP 품질
 * jpeg  — WebP 말고 JPEG 도 같이 굽는다 (크롤러 호환용)
 */
const RULES = [
  { match: /^bg-/, trim: false, max: 1920, q: 82 },
  { match: /^char-.*-full/, trim: true, max: 1400, q: 88 },
  { match: /^char-.*-(bust|cutin)/, trim: true, max: 640, q: 88 },
  { match: /^char-.*-sd/, trim: true, max: 512, q: 88 },
  { match: /^plaque-/, trim: true, max: 900, q: 88 },
  { match: /^(frame|panel|nameplate|btn|tab|tag|badge|divider)/, trim: true, max: 720, q: 88 },
  { match: /^icon-/, trim: true, max: 256, q: 90 },
  { match: /^emote-/, trim: true, max: 256, q: 90 },
  { match: /^fx-/, trim: true, max: 1200, q: 88 },
  { match: /^tile-back-/, trim: true, max: 342, q: 92 },
  { match: /^table-felt-/, trim: false, max: 1024, q: 84 },
  { match: /^table-/, trim: true, max: 1024, q: 88 },
  { match: /^logo-/, trim: true, max: 512, q: 90 },
  { match: /^og-image/, trim: false, max: 1200, q: 85, jpeg: true },
];

const ruleFor = (name) => RULES.find((r) => r.match.test(name)) ?? { trim: true, max: 1024, q: 88 };

const kb = (n) => `${(n / 1024).toFixed(0)}KB`;

async function main() {
  await mkdir(DEST, { recursive: true });
  // 한두 장만 다시 구울 때 114장을 통째로 돌리면 5분이 든다
  const onlyAt = process.argv.indexOf('--only');
  const only = onlyAt >= 0 ? process.argv[onlyAt + 1] : null;

  const files = (await readdir(SRC)).filter(
    (f) => /\.(png|jpe?g)$/i.test(f) && (!only || f.includes(only)),
  );
  if (files.length === 0) {
    console.log(
      only ? `assets/handoff/ 에 "${only}" 에 맞는 것이 없습니다.` : 'assets/handoff/ 에 이미지가 없습니다.',
    );
    return;
  }

  let totalIn = 0;
  let totalOut = 0;
  const rows = [];

  for (const file of files.sort()) {
    const name = path.basename(file, path.extname(file));
    const rule = ruleFor(name);

    let pipeline = sharp(path.join(SRC, file));
    const before = await pipeline.metadata();

    // 투명 여백 제거 — 알파가 있는 것만
    if (rule.trim && before.hasAlpha) {
      pipeline = sharp(await pipeline.trim({ threshold: 1 }).toBuffer());
    }

    const trimmed = await pipeline.metadata();
    const longest = Math.max(trimmed.width, trimmed.height);
    if (longest > rule.max) {
      const scale = rule.max / longest;
      pipeline = pipeline.resize(
        Math.round(trimmed.width * scale),
        Math.round(trimmed.height * scale),
        { kernel: 'lanczos3' },
      );
    }

    const out = await pipeline
      .webp({ quality: rule.q, alphaQuality: 100, effort: 6 })
      .toBuffer();
    await writeFile(path.join(DEST, `${name}.webp`), out);

    if (rule.jpeg) {
      await writeFile(
        path.join(DEST, `${name}.jpg`),
        await pipeline.jpeg({ quality: rule.q, mozjpeg: true }).toBuffer(),
      );
    }

    const after = await sharp(out).metadata();
    totalIn += (await sharp(path.join(SRC, file)).toBuffer()).byteLength;
    totalOut += out.byteLength;
    rows.push(
      `  ${name.padEnd(22)} ${`${before.width}x${before.height}`.padEnd(11)}` +
        `→ ${`${after.width}x${after.height}`.padEnd(11)} ${kb(out.byteLength).padStart(7)}` +
        `${rule.trim && before.hasAlpha ? '  (여백 제거)' : ''}`,
    );
  }

  console.log(rows.join('\n'));
  console.log(
    `\n${files.length}장 · ${kb(totalIn)} → ${kb(totalOut)} ` +
      `(${(100 - (totalOut / totalIn) * 100).toFixed(0)}% 감소) → public/art/`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
