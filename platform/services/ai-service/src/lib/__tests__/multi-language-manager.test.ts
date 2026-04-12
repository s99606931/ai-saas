// MTU-N363 다국어 관리 테스트
import { describe, it, expect } from 'vitest';
import { MultiLanguageManagerService } from '../multi-language-manager.js';

describe('MTU-N363 MultiLanguageManager', () => {
  const svc = new MultiLanguageManagerService('tenant-n363');

  it('FR-N363.1: 리소스 추가', () => {
    const r = svc.add('ko', 'welcome', '환영합니다');
    expect(r.value).toBe('환영합니다');
  });

  it('FR-N363.2: 번역 조회 (폴백)', () => {
    svc.add('ko', 'hello', '안녕하세요');
    expect(svc.get('en', 'hello')).toBe('안녕하세요'); // 폴백
  });

  it('FR-N363.3: 누락 번역 탐지', () => {
    svc.add('ko', 'goodbye', '안녕히가세요');
    const missing = svc.missing('ko', ['en', 'zh']);
    expect(missing.length).toBeGreaterThan(0);
  });

  it('FR-N363.4: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
