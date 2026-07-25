#!/usr/bin/env node
/**
 * 원화 에셋 생성기 — OpenAI Images API 로 handoff 폴더를 채운다.
 *
 *   OPENAI_API_KEY=... node scripts/gen-art.mjs --stage 1
 *   node scripts/gen-art.mjs --dry-run            # 키 없이 계획·비용만 출력
 *   node scripts/gen-art.mjs --only bg-lobby      # 한 장만 다시
 *   node scripts/gen-art.mjs --stage 1 --force    # 이미 있어도 덮어쓰기
 *
 * 원칙
 * - 키는 환경변수로만 받는다. 인자로도 받지 않고, 로그에도 남기지 않는다.
 * - 이미 있는 파일은 건너뛴다 (--force 로만 덮어씀).
 * - 실패한 항목은 전체를 중단시키지 않고 마지막에 요약한다.
 */

import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { MANIFEST } from './art-manifest.mjs';

const OUT_DIR = fileURLToPath(new URL('../assets/handoff/', import.meta.url));
const API = 'https://api.openai.com/v1';

// ── 인자 ──────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const value = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};

const options = {
  dryRun: flag('dry-run'),
  force: flag('force'),
  stage: value('stage', null),
  only: value('only', null),
  group: value('group', null),
  /** 지정하면 전 항목을 이 모델로 강제 */
  model: value('model', null),
  quality: value('quality', 'high'),
  concurrency: Number(value('concurrency', '2')),
  /** 이 금액(USD)을 넘길 것 같으면 남은 항목을 생성하지 않고 멈춘다 */
  budget: value('budget', null) === null ? null : Number(value('budget', '0')),
};

/**
 * 모델 선택 (2026-07 실측 기준)
 * - gpt-image-2   : 구도·디테일이 가장 좋지만 **투명 배경 미지원**
 * - gpt-image-1.5 : 투명 배경 지원, 품질도 충분
 * 그래서 불투명은 2, 투명은 1.5로 나눠 쓴다.
 */
const OPAQUE_MODEL = 'gpt-image-2';
const ALPHA_MODEL = 'gpt-image-1.5';
const modelFor = (item) => options.model ?? (item.alpha ? ALPHA_MODEL : OPAQUE_MODEL);

/** 출력 이미지 토큰 100만당 USD (요금표 확인 필요 — 실지출 추적용 근사) */
const USD_PER_MTOK = 40;
/** high 품질 실측 출력 토큰 수. medium 은 대략 1/4.3 이다. */
const EST_TOKENS = { '1024x1024': 4558, '1536x1024': 6000, '1024x1536': 6300 };
const QUALITY_FACTOR = { low: 0.12, medium: 0.23, high: 1, auto: 1 };

const qualityFor = (item) => item.quality ?? options.quality;
const estCost = (item) =>
  ((EST_TOKENS[item.gen] ?? 4558) * (QUALITY_FACTOR[qualityFor(item)] ?? 1) * USD_PER_MTOK) /
  1_000_000;

/** 실제 사용량 누적 */
const spent = { tokens: 0, images: 0 };
const spentUsd = () => (spent.tokens / 1_000_000) * USD_PER_MTOK;

/** 잔액 소진 — 재시도·후속 생성 모두 의미가 없어 전체를 멈춘다 */
class QuotaExhausted extends Error {}

// ── 유틸 ──────────────────────────────────────────────────────────────

const exists = async (p) => {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
};

/** 429·5xx 는 지수 백오프로 재시도 */
async function callApi(pathname, body, { attempt = 0 } = {}) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY 환경변수가 없습니다');

  let res;
  try {
    res = await fetch(`${API}${pathname}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    if (attempt >= 4) throw error;
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
    return callApi(pathname, body, { attempt: attempt + 1 });
  }

  // 잔액·한도 소진은 재시도해도 소용없다. 남은 수십 장을 줄줄이 실패시키지 말고 즉시 중단한다.
  // 429(quota)로 올 때도 있고 400(billing hard limit)으로 올 때도 있어 둘 다 본다.
  if (res.status === 429 || res.status === 400 || res.status >= 500) {
    const text = await res.text();
    if (/insufficient_quota|billing|hard limit|exceeded your current quota/i.test(text)) {
      throw new QuotaExhausted(text.replace(/\s+/g, ' ').slice(0, 160));
    }
    if (res.status === 400) throw new Error(`400 ${text.slice(0, 300)}`);
    if (attempt >= 4) throw new Error(`${res.status} ${text.slice(0, 200)}`);
    // 조직 한도가 분당 5장이라 레이트리밋은 넉넉히 기다린다
    await new Promise((r) => setTimeout(r, 15_000 * (attempt + 1)));
    return callApi(pathname, body, { attempt: attempt + 1 });
  }
  if (!res.ok) {
    // 키 자체는 절대 출력하지 않는다 — 응답 본문만
    throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
  }
  return res.json();
}

/**
 * 생성 결과를 목표 크기로 맞춘다.
 * gpt-image-1 은 1024x1024 / 1536x1024 / 1024x1536 만 지원하므로
 * 목표 비율로 센터 크롭한 뒤 목표 크기로 리사이즈한다.
 */
async function postProcess(buffer, item) {
  if (!item.out) return buffer;
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.warn(`  ! sharp 없음 — ${item.file} 은 원본 크기로 저장합니다`);
    return buffer;
  }
  const [w, h] = item.out;
  const pipeline = sharp(buffer)
    .resize(w, h, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
    .sharpen({ sigma: 0.6 });
  return item.format === 'jpeg'
    ? pipeline.jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toBuffer()
    : pipeline.png({ compressionLevel: 9 }).toBuffer();
}

// ── 생성 ──────────────────────────────────────────────────────────────

async function generate(item) {
  const body = {
    model: modelFor(item),
    prompt: item.prompt,
    size: item.gen,
    quality: qualityFor(item),
    n: 1,
  };
  // gpt-image-2 는 background 파라미터 자체를 거부한다 — 투명이 필요한 항목에만 붙인다
  if (item.alpha) {
    body.background = 'transparent';
    body.output_format = 'png';
  }

  const json = await callApi('/images/generations', body);
  spent.tokens += json.usage?.output_tokens ?? 0;
  spent.images++;
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) {
    const url = json.data?.[0]?.url;
    if (!url) throw new Error('응답에 이미지가 없습니다');
    const res = await fetch(url);
    return Buffer.from(await res.arrayBuffer());
  }
  return Buffer.from(b64, 'base64');
}

/** ref 가 있으면 그 이미지를 레퍼런스로 넣어 같은 인물/스타일을 유지한다 */
async function generateWithRef(item) {
  const refPath = path.join(OUT_DIR, item.ref);
  if (!(await exists(refPath))) {
    console.warn(`  ! 레퍼런스 ${item.ref} 없음 — 단독 생성으로 진행`);
    return generate(item);
  }
  const key = process.env.OPENAI_API_KEY;
  const form = new FormData();
  form.append('model', modelFor(item));
  form.append('prompt', item.prompt);
  form.append('size', item.gen);
  form.append('quality', qualityFor(item));
  if (item.alpha) form.append('background', 'transparent');
  form.append(
    'image[]',
    new Blob([await readFile(refPath)], { type: 'image/png' }),
    item.ref,
  );

  const res = await fetch(`${API}/images/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 300)}`);
  const json = await res.json();
  spent.tokens += json.usage?.output_tokens ?? 0;
  spent.images++;
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error('응답에 이미지가 없습니다');
  return Buffer.from(b64, 'base64');
}

// ── 메인 ──────────────────────────────────────────────────────────────

function selection() {
  let list = MANIFEST;
  if (options.only) {
    const ids = options.only.split(',').map((s) => s.trim());
    list = list.filter((i) => ids.includes(i.id));
  }
  if (options.stage) {
    const max = Number(options.stage);
    list = list.filter((i) => i.stage <= max);
  }
  if (options.group) list = list.filter((i) => i.group === options.group);
  // 캐릭터는 전신(레퍼런스)이 먼저 나와야 하므로 ref 없는 것부터
  return [...list].sort((a, b) => (a.ref ? 1 : 0) - (b.ref ? 1 : 0));
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const list = selection();

  if (list.length === 0) {
    console.log('선택된 항목이 없습니다. --stage 1 처럼 지정하세요.');
    return;
  }

  const cost = list.reduce((sum, i) => sum + estCost(i), 0);

  const qualities = new Set(list.map(qualityFor));
  console.log(`대상 ${list.length}장 · 품질 ${[...qualities].join('+')}`);
  if (options.budget !== null) console.log(`예산 상한 $${options.budget} (넘으면 중단)`);
  console.log(`모델: 불투명 ${OPAQUE_MODEL} / 투명 ${ALPHA_MODEL}${options.model ? ` (강제: ${options.model})` : ''}`);
  console.log(`예상 비용 약 $${cost.toFixed(2)} (재시도 제외, 요금표 확인 필요)\n`);

  const byGroup = new Map();
  for (const i of list) byGroup.set(i.group, (byGroup.get(i.group) ?? 0) + 1);
  for (const [group, n] of byGroup) console.log(`  ${group.padEnd(10)} ${n}장`);
  console.log('');

  if (options.dryRun) {
    for (const i of list) {
      console.log(`  [${i.stage}] ${i.file.padEnd(28)} ${i.gen}${i.alpha ? ' 투명' : '      '}  ${modelFor(i)}`);
    }
    console.log('\n--dry-run 이라 생성하지 않았습니다.');
    return;
  }

  const failed = [];
  const skipped = [];
  let quotaOut = false;
  let done = 0;
  const queue = [...list];

  const worker = async () => {
    for (;;) {
      const item = queue.shift();
      if (!item) return;
      const target = path.join(OUT_DIR, item.file);
      if (!options.force && (await exists(target))) {
        console.log(`  = ${item.file} (이미 있음, 건너뜀)`);
        done++;
        continue;
      }
      if (options.budget !== null && spentUsd() + estCost(item) > options.budget) {
        skipped.push(item.file);
        continue;
      }
      try {
        const raw = item.ref ? await generateWithRef(item) : await generate(item);
        await writeFile(target, await postProcess(raw, item));
        done++;
        console.log(`  + ${item.file} (${done}/${list.length})`);
      } catch (error) {
        if (error instanceof QuotaExhausted) {
          quotaOut = true;
          queue.length = 0;
          console.error(`\n  !! 잔액 소진으로 중단합니다: ${error.message}`);
          return;
        }
        failed.push({ id: item.id, message: error instanceof Error ? error.message : String(error) });
        console.error(`  ! ${item.file} 실패: ${error instanceof Error ? error.message : error}`);
      }
    }
  };

  // ref 가 있는 항목은 레퍼런스 생성이 끝난 뒤여야 하므로 2패스로 나눈다
  const first = queue.filter((i) => !i.ref);
  const second = queue.filter((i) => i.ref);
  queue.length = 0;
  queue.push(...first);
  await Promise.all(Array.from({ length: Math.max(1, options.concurrency) }, worker));
  queue.push(...second);
  await Promise.all(Array.from({ length: Math.max(1, options.concurrency) }, worker));

  console.log(`\n완료 ${done - failed.length}/${list.length}`);
  console.log(
    `사용량: ${spent.images}콜 · 출력 ${spent.tokens.toLocaleString()}토큰 ` +
      `· 실지출 약 $${spentUsd().toFixed(2)}`,
  );
  if (quotaOut) console.log('\n잔액이 떨어져 나머지는 생성하지 못했습니다.');
  if (skipped.length > 0) {
    // 예산 때문에 건너뛴 것을 반드시 밝힌다 — 조용히 빠지면 "다 됐다"로 읽힌다
    console.log(`\n예산($${options.budget}) 도달로 건너뜀 ${skipped.length}장:`);
    console.log('  ' + skipped.join(', '));
  }
  if (failed.length > 0) {
    console.log('실패:');
    for (const f of failed) console.log(`  ${f.id}: ${f.message}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
