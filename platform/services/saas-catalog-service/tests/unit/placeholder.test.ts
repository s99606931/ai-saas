// saas-catalog-service 플레이스홀더 테스트
// NOTE: 이 서비스는 catalog-service의 초기 스캐폴딩 잔재
//       catalog-service 사용 권장 (DESIGN-MTU-P06)
//       Phase 2 SaaS 마켓플레이스 구현 시 실제 테스트 추가 예정

import { describe, it, expect } from 'vitest';

describe('saas-catalog-service (placeholder)', () => {
  it('서비스 메타데이터가 정의되어 있다', () => {
    const metadata = {
      name: 'saas-catalog-service',
      status: 'deprecated',
      replacement: 'catalog-service',
    };
    expect(metadata.status).toBe('deprecated');
    expect(metadata.replacement).toBe('catalog-service');
  });
});
