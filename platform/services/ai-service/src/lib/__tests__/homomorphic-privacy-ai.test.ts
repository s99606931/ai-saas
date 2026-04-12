import { describe, it, expect } from 'vitest';
import { HomomorphicPrivacyAi } from '../homomorphic-privacy-ai';

describe('HomomorphicPrivacyAi', () => {
  const svc = new HomomorphicPrivacyAi();

  it('encrypts and decrypts with authorization', () => {
    const c = svc.encrypt(42, 'key-1');
    expect(svc.decrypt(c, 'key-1', true)).toBe(42);
  });

  it('blocks decryption without authorization', () => {
    const c = svc.encrypt(42, 'key-1');
    expect(() => svc.decrypt(c, 'key-1', false)).toThrow();
  });

  it('performs homomorphic addition', () => {
    const a = svc.encrypt(10, 'k');
    const b = svc.encrypt(20, 'k');
    const sum = svc.add(a, b);
    expect(svc.decrypt(sum, 'k', true)).toBe(30);
  });

  it('performs scalar multiplication', () => {
    const a = svc.encrypt(10, 'k');
    const r = svc.scalarMul(a, 5);
    expect(svc.decrypt(r, 'k', true)).toBe(50);
  });

  it('runs linear inference', () => {
    const x = [svc.encrypt(2, 'k'), svc.encrypt(3, 'k')];
    const result = svc.linearInference(x, [0.5, 2], 1);
    expect(svc.decrypt(result, 'k', true)).toBe(2 * 0.5 + 3 * 2 + 1);
  });

  it('reports noise budget', () => {
    const c = svc.encrypt(1, 'k');
    const b = svc.budgetReport(c);
    expect(b.current).toBe(b.initial);
  });

  it('blocks key mismatch', () => {
    const a = svc.encrypt(1, 'k1');
    const b = svc.encrypt(2, 'k2');
    expect(() => svc.add(a, b)).toThrow();
  });
});
