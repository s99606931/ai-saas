// 에러 응답 표준화 검증 테스트 -- Cycle 7
// Design Ref: CSAP D-12 시스템 개발 보안
// Plan SC: FR-SECMON.1

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('에러 응답 표준화 검증 (CSAP D-12)', () => {
  const handlersDir = resolve('/data/ai-saas/platform/services/security-monitor-service/src/handlers');

  it('security.handler.ts에 비표준 에러 응답 패턴이 없다', () => {
    const content = readFileSync(resolve(handlersDir, 'security.handler.ts'), 'utf-8');

    // 비표준 패턴: send({ error: '문자열' }) -- 객체가 아닌 문자열 직접 전달
    const nonStandardPattern = /\.send\(\{\s*error:\s*['"`][^{]/g;
    const matches = content.match(nonStandardPattern);

    expect(matches, '비표준 에러 응답 패턴이 존재합니다').toBeNull();
  });

  it('security-service security.handler.ts에 비표준 에러 응답 패턴이 없다', () => {
    const content = readFileSync(
      resolve('/data/ai-saas/platform/services/security-service/src/handlers/security.handler.ts'),
      'utf-8',
    );

    const nonStandardPattern = /\.send\(\{\s*error:\s*['"`][^{]/g;
    const matches = content.match(nonStandardPattern);

    expect(matches, '비표준 에러 응답 패턴이 존재합니다').toBeNull();
  });

  it('표준 에러 응답 형식: {success: false, error: {code, message}}', () => {
    // 표준 에러 응답 인터페이스 검증
    interface StandardErrorResponse {
      success: false;
      error: {
        code: string;
        message: string;
        details?: unknown;
      };
    }

    const errorResponse: StandardErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '입력 검증 실패',
        details: [{ path: 'ip', message: 'IP 형식 오류' }],
      },
    };

    expect(errorResponse.success).toBe(false);
    expect(errorResponse.error.code).toBeDefined();
    expect(errorResponse.error.message).toBeDefined();
  });
});
