// E2E 테스트 전용 Vitest 설정
// Design Ref: MTU-N01
// Plan SC: NFR-N01.3

import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['scenarios/**/*.e2e.test.ts'],
    testTimeout: 30000,
    hookTimeout: 10000,
    reporters: ['verbose'],
    passWithNoTests: false,
  },
});
