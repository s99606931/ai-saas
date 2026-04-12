import { describe, it, expect, beforeEach } from 'vitest';
import { PublicAdminLanguageCorrector } from '../public-admin-language-corrector';

describe('PublicAdminLanguageCorrector', () => {
  let corrector: PublicAdminLanguageCorrector;

  beforeEach(() => {
    corrector = new PublicAdminLanguageCorrector();
  });

  it('표준 용어를 등록한다', () => {
    corrector.registerTerm('귀사', '귀 기관');
    expect(corrector.getAuditLog().some(l => l.action === 'REGISTER_TERM')).toBe(true);
  });

  it('비표준 용어를 탐지한다', () => {
    corrector.registerTerm('귀사', '귀 기관');
    const result = corrector.inspect('귀사의 협조를 요청드립니다.');
    expect(result.totalIssues).toBe(1);
    expect(result.suggestions[0]!.nonStandard).toBe('귀사');
    expect(result.suggestions[0]!.standard).toBe('귀 기관');
  });

  it('비표준 용어가 없으면 totalIssues=0이다', () => {
    corrector.registerTerm('귀사', '귀 기관');
    const result = corrector.inspect('귀 기관의 협조를 요청드립니다.');
    expect(result.totalIssues).toBe(0);
  });

  it('교정을 적용한다', () => {
    corrector.registerTerm('귀사', '귀 기관');
    corrector.registerTerm('하여야', '해야');
    const result = corrector.correct('귀사는 서류를 제출하여야 합니다.');
    expect(result.corrected).toBe('귀 기관는 서류를 제출해야 합니다.');
    expect(result.correctionCount).toBe(2);
  });

  it('다중 출현 비표준 용어를 모두 교정한다', () => {
    corrector.registerTerm('귀사', '귀 기관');
    const result = corrector.correct('귀사는 귀사의 서류를 제출하십시오.');
    expect(result.correctionCount).toBe(2);
  });

  it('C등급 검사를 차단한다', () => {
    expect(() => corrector.inspect('테스트', 'C' as never)).toThrow('BLOCKED');
  });

  it('C등급 교정을 차단한다', () => {
    expect(() => corrector.correct('테스트', 'C' as never)).toThrow('BLOCKED');
  });
});
