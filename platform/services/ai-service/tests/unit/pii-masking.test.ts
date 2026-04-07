// PII 마스킹 테스트
// Design Ref: DESIGN-MTU-P10
// Plan SC: FR-P10.3
// CSAP: N2SF N-05 — O등급 데이터 PII 마스킹 후 전송

import { describe, it, expect } from 'vitest';
import { maskPII, containsPII } from '../../src/lib/pii-masking.js';

describe('maskPII (N2SF N-05 PII 마스킹)', () => {
  it('이메일 주소를 마스킹한다', () => {
    const input = '사용자 이메일: admin@example.com';
    const result = maskPII(input);
    expect(result).toContain('[EMAIL_MASKED]');
    expect(result).not.toContain('admin@example.com');
  });

  it('전화번호를 마스킹한다 (010 형식)', () => {
    const input = '연락처: 010-1234-5678';
    const result = maskPII(input);
    expect(result).toContain('[PHONE_MASKED]');
    expect(result).not.toContain('010-1234-5678');
  });

  it('전화번호를 마스킹한다 (02 형식)', () => {
    const input = '연락처: 02-123-4567';
    const result = maskPII(input);
    expect(result).toContain('[PHONE_MASKED]');
  });

  it('주민등록번호를 마스킹한다', () => {
    const input = '주민번호: 900101-1234567';
    const result = maskPII(input);
    expect(result).toContain('[RRN_MASKED]');
    expect(result).not.toContain('1234567');
  });

  it('카드 번호를 마스킹한다', () => {
    const input = '카드: 1234-5678-9012-3456';
    const result = maskPII(input);
    expect(result).toContain('[CARD_MASKED]');
    expect(result).not.toContain('1234-5678-9012-3456');
  });

  it('IP 주소를 마스킹한다', () => {
    const input = '접속 IP: 192.168.1.100';
    const result = maskPII(input);
    expect(result).toContain('[IP_MASKED]');
    expect(result).not.toContain('192.168.1.100');
  });

  it('PII가 없는 텍스트는 변경하지 않는다', () => {
    const input = '공공기관 SaaS 프레임워크 문서입니다';
    const result = maskPII(input);
    expect(result).toBe(input);
  });

  it('여러 PII를 동시에 마스킹한다', () => {
    const input = '이름: 홍길동, 이메일: hong@gov.kr, 전화: 010-9876-5432';
    const result = maskPII(input);
    expect(result).toContain('[EMAIL_MASKED]');
    expect(result).toContain('[PHONE_MASKED]');
    expect(result).not.toContain('hong@gov.kr');
    expect(result).not.toContain('010-9876-5432');
  });
});

describe('containsPII', () => {
  it('이메일이 포함된 텍스트를 탐지한다', () => {
    expect(containsPII('연락처: test@example.com')).toBe(true);
  });

  it('전화번호가 포함된 텍스트를 탐지한다', () => {
    expect(containsPII('번호: 010-1111-2222')).toBe(true);
  });

  it('주민등록번호가 포함된 텍스트를 탐지한다', () => {
    expect(containsPII('번호: 900101-1234567')).toBe(true);
  });

  it('카드 번호가 포함된 텍스트를 탐지한다', () => {
    expect(containsPII('카드: 1111-2222-3333-4444')).toBe(true);
  });

  it('PII 없는 텍스트를 감지하지 않는다', () => {
    expect(containsPII('일반 텍스트입니다')).toBe(false);
  });
});
