import { describe, it, expect } from 'vitest';
import { WhiteLabelEngine, type BrandConfig } from '../white-label-engine';

describe('WhiteLabelEngine', () => {
  const eng = new WhiteLabelEngine();
  const cfg: BrandConfig = {
    tenantId: 'T1',
    brandName: '한국공사',
    logoUrl: 'https://cdn.example.kr/logo.png',
    primaryColor: '#1A73E8',
    secondaryColor: '#FBBC04',
  };

  it('validates brand config', () => {
    const v = eng.validateBrand(cfg);
    expect(v.ok).toBe(true);
  });

  it('rejects invalid hex color', () => {
    const v = eng.validateBrand({ ...cfg, primaryColor: 'blue' });
    expect(v.ok).toBe(false);
  });

  it('generates theme variables', () => {
    const vars = eng.generateThemeVariables(cfg);
    expect(vars['--brand-primary']).toBe('#1A73E8');
    expect(vars['--brand-primary-hover']).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('renders email template', () => {
    const email = eng.renderEmail(
      cfg,
      '<h1>{{brandName}}</h1><p>안녕하세요 {{name}}</p>',
      { name: '홍길동', subject: '가입 환영' },
    );
    expect(email.html).toContain('한국공사');
    expect(email.html).toContain('홍길동');
    expect(email.subject).toContain('[한국공사]');
  });

  it('validates custom domain', () => {
    expect(eng.validateDomain('saas.example.kr').valid).toBe(true);
    expect(eng.validateDomain('bad..domain').valid).toBe(false);
    expect(eng.validateDomain('no-tld').valid).toBe(false);
  });

  it('checks brand consistency', () => {
    const result = eng.checkConsistency(cfg);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    const same = eng.checkConsistency({ ...cfg, secondaryColor: cfg.primaryColor });
    expect(same.warnings.length).toBeGreaterThan(0);
  });
});
