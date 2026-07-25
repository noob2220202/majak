import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // 엔진은 순수 결정론 코어 — any 전면 금지 (PLAN.md §8.3)
    files: ['packages/engine/src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
  {
    // 빌드 스크립트는 Node 환경 (브라우저 전역이 아님)
    files: ['**/scripts/**/*.{js,mjs,ts}', '**/*.config.{js,ts,mjs}'],
    languageOptions: {
      globals: { console: 'readonly', process: 'readonly', URL: 'readonly', __dirname: 'readonly' },
    },
  },
  {
    files: ['apps/client/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
);
