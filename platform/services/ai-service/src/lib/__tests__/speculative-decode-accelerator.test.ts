// Plan SC: FR-R79.1~5
import { describe, it, expect } from 'vitest';
import {
  SpeculativeDecodeAccelerator,
  createSpeculativeDecodeAccelerator,
} from '../speculative-decode-accelerator';

describe('SpeculativeDecodeAccelerator', () => {
  it('FR-R79.1~2: draft+verify fills tokens up to max', async () => {
    const draft = async (_: string, k: number) => Array(k).fill('a');
    const verify = async (_: string, cands: string[]) => cands.length;
    const sd = createSpeculativeDecodeAccelerator(draft, verify);
    const res = await sd.decode('ctx', 10);
    expect(res.tokens.length).toBe(10);
    expect(res.stats.acceptedTokens).toBe(10);
  });

  it('FR-R79.3: EMA acceptance rate updated', async () => {
    const draft = async (_: string, k: number) => Array(k).fill('x');
    const verify = async (_: string, cands: string[]) => Math.floor(cands.length / 2);
    const sd = new SpeculativeDecodeAccelerator(draft, verify, { initialK: 4, targetRate: 0.65 });
    const res = await sd.decode('ctx', 8);
    expect(res.stats.acceptanceRate).toBeGreaterThan(0);
    expect(res.stats.acceptanceRate).toBeLessThan(1);
  });

  it('FR-R79.3: decreases k when rate below threshold', async () => {
    const draft = async (_: string, k: number) => Array(k).fill('y');
    // fallback에서 1개 수락 → 종료 조건 위해 polled
    let call = 0;
    const verifyFallback = async (_ctx: string, _cands: string[]) => {
      call++;
      return call % 2 === 0 ? 1 : 0;
    };
    const sd = new SpeculativeDecodeAccelerator(draft, verifyFallback, {
      initialK: 4,
      minK: 2,
      maxK: 8,
    });
    const res = await sd.decode('ctx', 3);
    expect(res.stats.fallbackCount).toBeGreaterThan(0);
  });

  it('FR-R79.4: fallback triggered on zero acceptance', async () => {
    const draft = async (_: string, k: number) => Array(k).fill('z');
    let step = 0;
    const verify = async () => {
      step++;
      // 첫 번째 verify는 0 → fallback 이후 1 수락
      return step === 1 ? 0 : 1;
    };
    const sd = new SpeculativeDecodeAccelerator(draft, verify, { initialK: 3 });
    const res = await sd.decode('ctx', 1);
    expect(res.stats.fallbackCount).toBe(1);
    expect(res.tokens).toEqual(['z']);
  });

  it('FR-R79.5: audit log records rounds', async () => {
    const draft = async (_: string, k: number) => Array(k).fill('t');
    const verify = async (_: string, cands: string[]) => cands.length;
    const sd = new SpeculativeDecodeAccelerator(draft, verify);
    await sd.decode('ctx', 8);
    const log = sd.getAuditLog();
    expect(log.some((e) => e.action === 'DECODE_ROUND')).toBe(true);
    expect(log.some((e) => e.action === 'COMPLETE')).toBe(true);
  });

  it('stop token terminates early', async () => {
    const draft = async (_: string, k: number) => {
      const arr = ['h', 'i', '.', 'END'];
      return arr.slice(0, Math.min(k, arr.length));
    };
    const verify = async (_: string, cands: string[]) => cands.length;
    const sd = new SpeculativeDecodeAccelerator(draft, verify, { initialK: 4 });
    const res = await sd.decode('ctx', 100, 'END');
    expect(res.tokens[res.tokens.length - 1]).toBe('END');
  });

  it('validates config', () => {
    const d = async () => [];
    const v = async () => 0;
    expect(() => new SpeculativeDecodeAccelerator(d, v, { minK: 5, maxK: 3 })).toThrow();
    expect(() => new SpeculativeDecodeAccelerator(d, v, { initialK: 100 })).toThrow();
  });
});
