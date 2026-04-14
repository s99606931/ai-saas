// Design Ref: SVC-AI-ADV-R666.design.md — AI기반 네트워크 트래픽 분류 v3
// Plan SC: FR-R666.1~5

import { createHash } from 'crypto';

export type TrafficCategory = 'BUSINESS' | 'MANAGEMENT' | 'ANOMALY';

interface NetworkFlow {
  srcIp: string;
  dstIp: string;
  port: number;
  bytesPerSec: number;
}
interface ClassifyResult {
  maskedSrc: string;
  maskedDst: string;
  category: TrafficCategory;
}
interface AuditEntry { timestamp: string; action: string; details?: Record<string, unknown> }

const MGMT_PORTS = new Set([22, 3389, 9100]);
const KNOWN_BUSINESS_PORTS = new Set([80, 443, 8080, 8443]);

function mask(v: string): string {
  return createHash('sha256').update(v).digest('hex').substring(0, 16);
}

export class NetworkTrafficClassifierAIV3 {
  private auditLog: AuditEntry[] = [];

  classify(flow: NetworkFlow, dataGrade?: string): ClassifyResult {
    if (dataGrade === 'C' || dataGrade === 'S') {
      throw new Error(`BLOCKED: ${dataGrade}등급 AI API 전송 금지 (N2SF N-05)`);
    }
    let category: TrafficCategory;
    if (MGMT_PORTS.has(flow.port)) {
      category = 'MANAGEMENT';
    } else if (flow.bytesPerSec > 1e8 || (!KNOWN_BUSINESS_PORTS.has(flow.port) && flow.bytesPerSec > 1e6)) {
      category = 'ANOMALY';
    } else {
      category = 'BUSINESS';
    }
    const result: ClassifyResult = {
      maskedSrc: mask(flow.srcIp),
      maskedDst: mask(flow.dstIp),
      category,
    };
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'CLASSIFY_FLOW',
      details: { category, port: flow.port },
    });
    return result;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
