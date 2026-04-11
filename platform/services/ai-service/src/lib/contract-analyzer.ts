// AI 계약서 자동 분석 -- FR-N278.1~FR-N278.6
// Design Ref: MTU-N278 DESIGN §1~§6
// CSAP: D-06 감사, D-08 접근 통제, D-12 개발 보안

import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

export type ClauseType = 'payment' | 'duration' | 'obligation' | 'penalty' | 'termination' | 'confidentiality' | 'liability' | 'general';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface ContractClause {
  id: string;
  type: ClauseType;
  number: string;
  title: string;
  content: string;
  extractedValues: Record<string, string | number>;
}

export interface ContractDocument {
  id: string;
  title: string;
  parties: string[];
  clauses: ContractClause[];
  totalAmount?: number;
  startDate?: string;
  endDate?: string;
  parsedAt: string;
}

export interface RiskAssessment {
  clauseId: string;
  riskLevel: RiskLevel;
  description: string;
  recommendation: string;
}

export interface ContractComparison {
  id: string;
  contractA: string;
  contractB: string;
  differences: ClauseDifference[];
  analyzedAt: string;
}

export interface ClauseDifference {
  clauseType: ClauseType;
  inA: string | null;
  inB: string | null;
  significance: RiskLevel;
}

export interface RenewalAlert {
  contractId: string;
  contractTitle: string;
  expiryDate: string;
  daysRemaining: number;
  alertLevel: 'normal' | 'warning' | 'urgent';
}

// -- 저장소/감사 ──────────────────────────────────────────────────────────────

const contracts = new Map<string, ContractDocument>();
const auditLog: { id: string; action: string; actor: string; timestamp: string }[] = [];

function recordAudit(action: string, actor: string): void {
  auditLog.push({ id: randomUUID(), action, actor, timestamp: new Date().toISOString() });
}

export function getContractAuditLog() { return [...auditLog]; }

// -- §1 계약서 파싱 ──────────────────────────────────────────────────────────

const CLAUSE_PATTERNS: { type: ClauseType; keywords: string[] }[] = [
  { type: 'payment', keywords: ['대금', '지급', '금액', '비용', '요금', '결제'] },
  { type: 'duration', keywords: ['기간', '계약일', '만료', '갱신', '연장'] },
  { type: 'obligation', keywords: ['의무', '책임', '이행', '준수', '제공'] },
  { type: 'penalty', keywords: ['위약', '벌금', '손해배상', '지연이자'] },
  { type: 'termination', keywords: ['해지', '해제', '종료', '취소'] },
  { type: 'confidentiality', keywords: ['비밀', '기밀', '보안', '개인정보'] },
  { type: 'liability', keywords: ['면책', '보증', '책임한도', '불가항력'] },
];

export function parseContract(params: {
  title: string;
  text: string;
  parties: string[];
  actor: string;
}): ContractDocument {
  const sections = params.text.split(/제\d+조/).filter(Boolean);
  const clauses: ContractClause[] = [];

  for (let i = 0; i < sections.length; i++) {
    const content = (sections[i] ?? '').trim();
    if (!content) continue;

    const titleMatch = content.match(/^\((.+?)\)/);
    const clauseType = classifyClause(content);
    const extractedValues = extractValues(content, clauseType);

    clauses.push({
      id: randomUUID(),
      type: clauseType,
      number: String(i + 1),
      title: titleMatch?.[1] || `제${i + 1}조`,
      content,
      extractedValues,
    });
  }

  const doc: ContractDocument = {
    id: randomUUID(),
    title: params.title,
    parties: params.parties,
    clauses,
    totalAmount: extractTotalAmount(params.text),
    startDate: extractDate(params.text, '시작'),
    endDate: extractDate(params.text, '만료'),
    parsedAt: new Date().toISOString(),
  };

  contracts.set(doc.id, doc);
  recordAudit('CONTRACT_PARSED', params.actor);
  return doc;
}

function classifyClause(content: string): ClauseType {
  for (const { type, keywords } of CLAUSE_PATTERNS) {
    if (keywords.some((kw) => content.includes(kw))) return type;
  }
  return 'general';
}

function extractValues(content: string, _type: ClauseType): Record<string, string | number> {
  const values: Record<string, string | number> = {};
  const amountMatch = content.match(/(\d{1,3}(,\d{3})*)\s*원/);
  if (amountMatch?.[1]) values.amount = parseInt(amountMatch[1].replace(/,/g, ''), 10);
  const dateMatch = content.match(/(\d{4})[.-](\d{1,2})[.-](\d{1,2})/);
  if (dateMatch?.[1] && dateMatch[2] && dateMatch[3]) values.date = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
  return values;
}

function extractTotalAmount(text: string): number | undefined {
  const match = text.match(/총\s*(?:계약)?(?:금액|대금)[:\s]*(\d{1,3}(?:,\d{3})*)\s*원/);
  return match?.[1] ? parseInt(match[1].replace(/,/g, ''), 10) : undefined;
}

function extractDate(text: string, keyword: string): string | undefined {
  const pattern = new RegExp(`${keyword}[:\\s]*(\\d{4})[.\\-](\\d{1,2})[.\\-](\\d{1,2})`);
  const match = text.match(pattern);
  return match?.[1] && match[2] && match[3] ? `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}` : undefined;
}

// -- §3 위험 조항 식별 ────────────────────────────────────────────────────────

const RISK_PATTERNS: { pattern: RegExp; risk: RiskLevel; description: string; recommendation: string }[] = [
  { pattern: /무한\s*책임/, risk: 'critical', description: '무한 책임 조항', recommendation: '책임 한도 금액 명시 필요' },
  { pattern: /자동\s*갱신/, risk: 'medium', description: '자동 갱신 조항', recommendation: '자동 갱신 조건 및 해지 절차 확인' },
  { pattern: /일방적\s*(?:해지|변경)/, risk: 'high', description: '일방적 해지/변경 가능 조항', recommendation: '상호 합의 조건 추가 권장' },
  { pattern: /위약금\s*(?:없|면제)/, risk: 'low', description: '위약금 면제 조항', recommendation: '유리한 조항이나 상대방 이탈 위험 검토' },
  { pattern: /준거법[:\s]*외국/, risk: 'high', description: '외국 준거법 적용', recommendation: '대한민국 법률 적용으로 변경 권장' },
];

export function assessRisks(contractId: string, actor: string): RiskAssessment[] {
  const contract = contracts.get(contractId);
  if (!contract) return [];

  const risks: RiskAssessment[] = [];
  for (const clause of contract.clauses) {
    for (const { pattern, risk, description, recommendation } of RISK_PATTERNS) {
      if (pattern.test(clause.content)) {
        risks.push({ clauseId: clause.id, riskLevel: risk, description, recommendation });
      }
    }
  }

  recordAudit('RISKS_ASSESSED', actor);
  return risks;
}

// -- §4 비교 분석 ────────────────────────────────────────────────────────────

export function compareContracts(contractIdA: string, contractIdB: string, actor: string): ContractComparison {
  const a = contracts.get(contractIdA);
  const b = contracts.get(contractIdB);
  if (!a || !b) throw new Error('계약서를 찾을 수 없습니다');

  const differences: ClauseDifference[] = [];
  const allTypes = new Set([...a.clauses.map((c) => c.type), ...b.clauses.map((c) => c.type)]);

  for (const type of allTypes) {
    const clauseA = a.clauses.find((c) => c.type === type);
    const clauseB = b.clauses.find((c) => c.type === type);

    if (!clauseA || !clauseB || clauseA.content !== clauseB.content) {
      differences.push({
        clauseType: type,
        inA: clauseA?.content?.substring(0, 100) || null,
        inB: clauseB?.content?.substring(0, 100) || null,
        significance: !clauseA || !clauseB ? 'high' : 'medium',
      });
    }
  }

  recordAudit('CONTRACTS_COMPARED', actor);
  return { id: randomUUID(), contractA: contractIdA, contractB: contractIdB, differences, analyzedAt: new Date().toISOString() };
}

// -- §5 갱신 알림 ────────────────────────────────────────────────────────────

export function checkRenewals(): RenewalAlert[] {
  const alerts: RenewalAlert[] = [];
  const now = Date.now();

  for (const [, contract] of contracts) {
    if (!contract.endDate) continue;
    const expiryTime = new Date(contract.endDate).getTime();
    const daysRemaining = Math.ceil((expiryTime - now) / (1000 * 60 * 60 * 24));

    if (daysRemaining <= 90) {
      alerts.push({
        contractId: contract.id,
        contractTitle: contract.title,
        expiryDate: contract.endDate,
        daysRemaining,
        alertLevel: daysRemaining <= 30 ? 'urgent' : daysRemaining <= 60 ? 'warning' : 'normal',
      });
    }
  }

  return alerts.sort((a, b) => a.daysRemaining - b.daysRemaining);
}

export function getContract(id: string) { return contracts.get(id); }
export function listContracts() { return Array.from(contracts.values()); }
