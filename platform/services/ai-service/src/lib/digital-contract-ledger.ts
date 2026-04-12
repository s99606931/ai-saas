// Design Ref: MTU-N437 §디지털 계약 원장
// Plan SC: FR-N437.1~5

import { createHash } from 'node:crypto';

export interface Contract {
  contractId: string;
  title: string;
  parties: string[];
  amountKrw: number;
  startDate: string;
  endDate: string;
  documentContent: string;
}

export type LedgerAction = 'create' | 'amend' | 'terminate';

export interface LedgerEntry {
  index: number;
  contractId: string;
  action: LedgerAction;
  payload: string;
  prevHash: string;
  hash: string;
  timestamp: string;
}

export interface IntegrityReport {
  valid: boolean;
  brokenAt?: number;
  totalEntries: number;
}

export class DigitalContractLedger {
  private entries: LedgerEntry[] = [];

  private computeHash(index: number, contractId: string, action: LedgerAction, payload: string, prevHash: string): string {
    return createHash('sha256').update(`${index}|${contractId}|${action}|${payload}|${prevHash}`).digest('hex');
  }

  /** FR-N437.1 계약 등록 */
  registerContract(contract: Contract, timestamp: string): LedgerEntry {
    const payload = JSON.stringify(contract);
    return this.append(contract.contractId, 'create', payload, timestamp);
  }

  /** FR-N437.2 변경 이벤트 추가 */
  appendAmendment(contractId: string, diff: Record<string, unknown>, timestamp: string): LedgerEntry {
    return this.append(contractId, 'amend', JSON.stringify(diff), timestamp);
  }

  terminate(contractId: string, reason: string, timestamp: string): LedgerEntry {
    return this.append(contractId, 'terminate', reason, timestamp);
  }

  private append(contractId: string, action: LedgerAction, payload: string, timestamp: string): LedgerEntry {
    const index = this.entries.length;
    const prevHash = this.entries.at(-1)?.hash ?? '0'.repeat(64);
    const hash = this.computeHash(index, contractId, action, payload, prevHash);
    const entry: LedgerEntry = { index, contractId, action, payload, prevHash, hash, timestamp };
    this.entries.push(entry);
    return entry;
  }

  /** FR-N437.3 무결성 검증 */
  verifyIntegrity(): IntegrityReport {
    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      if (!entry) continue;
      const prevHash = i === 0 ? '0'.repeat(64) : this.entries[i - 1]?.hash ?? '';
      if (entry.prevHash !== prevHash) {
        return { valid: false, brokenAt: i, totalEntries: this.entries.length };
      }
      const expected = this.computeHash(entry.index, entry.contractId, entry.action, entry.payload, entry.prevHash);
      if (entry.hash !== expected) {
        return { valid: false, brokenAt: i, totalEntries: this.entries.length };
      }
    }
    return { valid: true, totalEntries: this.entries.length };
  }

  /** FR-N437.4 시점별 상태 복원 */
  restoreAt(contractId: string, beforeIndex: number): Contract | null {
    let state: Contract | null = null;
    for (let i = 0; i < Math.min(beforeIndex + 1, this.entries.length); i++) {
      const e = this.entries[i];
      if (!e || e.contractId !== contractId) continue;
      if (e.action === 'create') {
        state = JSON.parse(e.payload) as Contract;
      } else if (e.action === 'amend' && state !== null) {
        const diff = JSON.parse(e.payload) as Partial<Contract>;
        state = Object.assign({}, state, diff);
      } else if (e.action === 'terminate') {
        state = null;
      }
    }
    return state;
  }

  /** FR-N437.5 감사 리포트 */
  generateAuditReport(): string {
    const lines: string[] = ['# 계약 원장 감사 리포트', '', `총 이벤트: ${this.entries.length}`, ''];
    for (const e of this.entries) {
      lines.push(`- [${e.index}] ${e.timestamp} ${e.action} ${e.contractId} hash=${e.hash.slice(0, 16)}...`);
    }
    return lines.join('\n');
  }

  getEntries(): readonly LedgerEntry[] {
    return this.entries;
  }
}
