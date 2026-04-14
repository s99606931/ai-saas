import { describe, it, expect, beforeEach } from 'vitest';
import { BlockchainAuditTrailAIV2 } from '../blockchain-audit-trail-ai-v2';

describe('BlockchainAuditTrailAIV2', () => {
  let chain: BlockchainAuditTrailAIV2;

  beforeEach(() => {
    chain = new BlockchainAuditTrailAIV2('AUDIT-CHAIN');
  });

  it('FR-R702.1: starts with genesis block', () => {
    const blocks = chain.getChain();
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.index).toBe(0);
    expect(blocks[0]!.action).toBe('GENESIS');
  });

  it('FR-R702.2/3: append records block with hash chain', () => {
    const b1 = chain.append({ actorId: 'user-42', action: 'LOGIN', payload: 'ok' });
    expect(b1.index).toBe(1);
    expect(b1.maskedActorId).toHaveLength(16);
    expect(b1.maskedActorId).not.toContain('user-42');
    expect(b1.prevHash).toBe(chain.getChain()[0]!.blockHash);
  });

  it('FR-R702.2: blocks C/S grade (N2SF N-05)', () => {
    expect(() => chain.append({ actorId: 'u', action: 'X', payload: 'p' }, 'C')).toThrow('BLOCKED');
    expect(() => chain.append({ actorId: 'u', action: 'X', payload: 'p' }, 'S')).toThrow('BLOCKED');
  });

  it('FR-R702.4: verifyChain true for untampered chain', () => {
    chain.append({ actorId: 'u', action: 'READ', payload: 'r' });
    chain.append({ actorId: 'u', action: 'WRITE', payload: 'w' });
    expect(chain.verifyChain()).toBe(true);
  });

  it('FR-R702.4: verifyChain false after tampering', () => {
    chain.append({ actorId: 'u', action: 'READ', payload: 'r' });
    chain._tamper(1, 'HACKED');
    expect(chain.verifyChain()).toBe(false);
  });

  it('FR-R702.2: rejects empty action', () => {
    expect(() => chain.append({ actorId: 'u', action: '', payload: 'p' })).toThrow('INVALID_ACTION');
  });

  it('FR-R702.5: audit log append-only', () => {
    chain.append({ actorId: 'user-42', action: 'X', payload: 'p' });
    chain.verifyChain();
    const logs = chain.getAuditLog();
    expect(logs.some((e) => e.action === 'APPEND_BLOCK')).toBe(true);
    expect(logs.some((e) => e.action === 'VERIFY_OK')).toBe(true);
    for (const e of logs) {
      expect(JSON.stringify(e.details ?? {})).not.toContain('user-42');
    }
  });
});
