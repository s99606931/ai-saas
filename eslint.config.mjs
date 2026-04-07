// ESLint Flat Config — 공공기관 SaaS 프레임워크
// Design Ref: CLAUDE.md §4 Dead Code 정책, §1 절대 제약
// CSAP: D-12 시스템 개발 보안 — 코드 품질 정적 분석

import tseslint from 'typescript-eslint';

export default tseslint.config(
  // 전역 무시 패턴
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/coverage/**',
      '**/test-results/**',
      '**/playwright-report/**',
      'docs-portal/**',
    ],
  },

  // TypeScript 기본 규칙
  ...tseslint.configs.recommended,

  // 프로젝트 커스텀 규칙
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // CLAUDE.md §4: Dead Code 정책 — 미사용 변수 경고
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],

      // CSAP D-12: 안전한 코딩 관행
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',

      // 하드코딩 시크릿 방지 보조 (주요 방어는 gitleaks)
      'no-restricted-syntax': ['error', {
        selector: 'VariableDeclarator[init.value=/^(sk-|ghp_|ghs_|github_pat_)/]',
        message: 'CSAP D-09: 하드코딩된 API 키/토큰 사용 금지. 환경 변수를 사용하세요.',
      }],

      // 코드 품질
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],

      // CLAUDE.md: 함수 크기 (80줄) — ESLint로 부분 강제
      'max-lines-per-function': ['warn', {
        max: 80,
        skipBlankLines: true,
        skipComments: true,
      }],
    },
  },

  // 테스트 파일 완화 규칙
  {
    files: ['**/*.test.ts', '**/*.spec.ts', '**/tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      'max-lines-per-function': 'off',
      'no-console': 'off',
    },
  },
);
