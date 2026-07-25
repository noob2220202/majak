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
  model: value('model', 'gpt-image-1'),
  quality: value('quality', 'high'),
  concurrency: Number(value('concurrency', '2')),
};

/** 1024x1024 기준 대략 단가(USD). 정확한 값은 OpenAI 요금표를 확인할 것. */
const UNIT_COST = { low: 0.02, medium: 0.06, high: 0.19 };
const SIZE_FACTOR = { '1024x1024': 1, '1536x1024': 1.5, '1024x1536': 1.5 };

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

  if (res.status === 429 || res.status >= 500) {
    if (attempt >= 4) throw new Error(`${res.status} ${(await res.text()).slice(0, 200)}`);
    await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
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
    model: options.model,
    prompt: item.prompt,
    size: item.gen,
    n: 1,
  };
  if (options.model === 'gpt-image-1') {
    body.quality = options.quality;
    body.output_format = item.format === 'jpeg' ? 'jpeg' : 'png';
    if (item.alpha) {
      body.background = 'transparent';
      body.output_format = 'png';
    }
  }

  const json = await callApi('/images/generations', body);
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
  form.append('model', options.model);
  form.append('prompt', item.prompt);
  form.append('size', item.gen);
  form.append('quality', options.quality);
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

  const cost = list.reduce(
    (sum, i) => sum + (UNIT_COST[options.quality] ?? 0.19) * (SIZE_FACTOR[i.gen] ?? 1),
    0,
  );

  console.log(`대상 ${list.length}장 · 품질 ${options.quality} · 모델 ${options.model}`);
  console.log(`예상 비용 약 $${cost.toFixed(2)} (재시도 제외, 요금표 확인 필요)\n`);

  const byGroup = new Map();
  for (const i of list) byGroup.set(i.group, (byGroup.get(i.group) ?? 0) + 1);
  for (const [group, n] of byGroup) console.log(`  ${group.padEnd(10)} ${n}장`);
  console.log('');

  if (options.dryRun) {
    for (const i of list) console.log(`  [${i.stage}] ${i.file.padEnd(28)} ${i.gen}${i.alpha ? ' 투명' : ''}`);
    console.log('\n--dry-run 이라 생성하지 않았습니다.');
    return;
  }

  const failed = [];
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
      try {
        const raw = item.ref ? await generateWithRef(item) : await generate(item);
        await writeFile(target, await postProcess(raw, item));
        done++;
        console.log(`  + ${item.file} (${done}/${list.length})`);
      } catch (error) {
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
