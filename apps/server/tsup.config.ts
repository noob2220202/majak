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
  // 전부 번들하되 네이티브 모듈(better-sqlite3)만 제외 (noExternal이 external보다 우선하므로 부정 전방탐색 사용)
  noExternal: [/^(?!better-sqlite3$)/],
  external: ['better-sqlite3', 'bufferutil', 'utf-8-validate'],
});
