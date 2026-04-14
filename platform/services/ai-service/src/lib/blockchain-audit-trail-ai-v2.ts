// Design Ref: SVC-AI-ADV-R702.design.md — AI기반 블록체인 감사 추적 v2
// Plan SC: FR-R702.1~5

import { createHash } from 'crypto';

interface Block {
  index: number;
  timestamp: string;
  maskedActorId: string;
  action: string;
  payload: string;
  prevHash: string;
  blockHash: string;
}
interface AppendInput {
  actorId: string;
  action: string;
  payload: string;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

function sha256(data: string): string {
  return createHash('sha256').update(data).digest('hex');
}

function maskId(value: string): string {
  return sha256(value).substring(0, 16);
}

function computeHash(b: Omit<Block, 'blockHash'>): string {
  return sha256(`${b.index}|${b.prevHash}|${b.maskedActorId}|${b.action}|${b.timestamp}|${b.payload}`);
}

export class BlockchainAuditTrailAIV2 {
  private chain: Block[] = [];
  private auditLog: AuditEntry[] = [];

  constructor(public readonly chainId: string) {
    const genesis: Block = {
      index: 0,
      timestamp: new Date().toISOString(),
      maskedActorId: maskId('GENESIS'),
      action: 'GENESIS',
      payload: chainId,
      prevHash: '0'.repeat(64),
      blockHash: '',
    };
    genesis.blockHash = computeHash(genesis);
    this.chain.push(genesis);
    this.auditLog.push({ timestamp: genesis.timestamp, action: 'GENESIS', details: { chainId } });
  }

  append(input: AppendInput, dataGrade?: string): Block {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    if (!input.action) throw new Error('INVALID_ACTION');
    const prev = this.chain[this.chain.length - 1]!;
    const block: Block = {
      index: prev.index + 1,
      timestamp: new Date().toISOString(),
      maskedActorId: maskId(input.actorId),
      action: input.action,
      payload: input.payload,
      prevHash: prev.blockHash,
      blockHash: '',
    };
    block.blockHash = computeHash(block);
    this.chain.push(block);
    this.auditLog.push({
      timestamp: block.timestamp,
      action: 'APPEND_BLOCK',
      details: { index: block.index, maskedActorId: block.maskedActorId, action: input.action, blockHash: block.blockHash },
    });
    return block;
  }

  verifyChain(): boolean {
    for (let i = 0; i < this.chain.length; i++) {
      const b = this.chain[i]!;
      const recomputed = computeHash({
        index: b.index,
        timestamp: b.timestamp,
        maskedActorId: b.maskedActorId,
        action: b.action,
        payload: b.payload,
        prevHash: b.prevHash,
      });
      if (recomputed !== b.blockHash) {
        this.auditLog.push({ timestamp: new Date().toISOString(), action: 'VERIFY_FAIL', details: { index: i } });
        return false;
      }
      if (i > 0 && this.chain[i - 1]!.blockHash !== b.prevHash) {
        this.auditLog.push({ timestamp: new Date().toISOString(), action: 'VERIFY_FAIL', details: { index: i } });
        return false;
      }
    }
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'VERIFY_OK' });
    return true;
  }

  getChain(): Block[] {
    return [...this.chain];
  }

  // Test hook: intentional tampering (used only by tests to validate verifyChain)
  _tamper(index: number, newAction: string): void {
    const b = this.chain[index];
    if (!b) throw new Error('INVALID_INDEX');
    b.action = newAction;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
