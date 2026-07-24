import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  // CJS 단일 번들: 워크스페이스 패키지 포함 전부 번들해 런타임 node_modules 없이 구동
  format: ['cjs'],
  platform: 'node',
  target: 'node20',
  clean: true,
  sourcemap: true,
  shims: true,
  noExternal: [/.*/],
  // ws의 선택적 네이티브 가속 모듈 — 없어도 동작 (try/catch require)
  external: ['bufferutil', 'utf-8-validate'],
});
