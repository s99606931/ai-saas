// 준수 현황 대시보드 핸들러
// Design Ref: DESIGN-MTU-P14 §2
// Plan SC: FR-P14.1~FR-P14.4
// CSAP: D-06, N-01

import type { FastifyRequest, FastifyReply } from 'fastify';
import { logComplianceEvent } from '../lib/audit.js';

// --- CSAP 79항목 체크리스트 + 동적 준수 상태 ---
// Design Ref: DESIGN-MTU-P14 §2
// NOTE: 실 운영 환경에서는 DB 저장 + 감사 이벤트 기반 동적 갱신
// 현재: 프레임워크 코드 구현 기준 정적 평가

interface CsapDomainConfig {
  id: string;
  name: string;
  items: number;
  /** 프레임워크에서 구현 완료된 항목 수 (수동 평가 반영) */
  implementedItems: number;
}

// CSAP 표준등급 13개 분야 79항목 (checklist-master.md 기준 정합)
const CSAP_DOMAINS: CsapDomainConfig[] = [
  { id: 'D-01', name: '정보보호 정책', items: 4, implementedItems: 4 },
  { id: 'D-02', name: '정보보호 조직', items: 3, implementedItems: 3 },
  { id: 'D-03', name: '자산 관리', items: 4, implementedItems: 4 },
  { id: 'D-04', name: '인적 보안', items: 5, implementedItems: 5 },
  { id: 'D-05', name: '물리적 보안', items: 4, implementedItems: 3 },   // 물리 보안 1항목: 운영 환경 구성 시 충족
  { id: 'D-06', name: '침해사고 관리', items: 5, implementedItems: 5 },
  { id: 'D-07', name: '서비스 연속성', items: 3, implementedItems: 2 },  // DR/백업 1항목: 인프라 구성 시 충족
  { id: 'D-08', name: '접근 통제', items: 12, implementedItems: 12 },
  { id: 'D-09', name: '암호화', items: 4, implementedItems: 4 },
  { id: 'D-10', name: '네트워크 보안', items: 8, implementedItems: 6 },  // 방화벽/IDS 2항목: 인프라 구성 시 충족
  { id: 'D-11', name: '시스템 보안', items: 7, implementedItems: 6 },    // OS 보안 1항목: 운영 환경 구성 시 충족
  { id: 'D-12', name: '시스템 개발 보안', items: 10, implementedItems: 10 },
  { id: 'D-13', name: '공급망 보안', items: 10, implementedItems: 10 },
];

interface N2sfDomainConfig {
  id: string;
  name: string;
  items: number;
  implementedItems: number;
  status: 'pass' | 'partial' | 'fail';
}

const N2SF_DOMAINS: N2sfDomainConfig[] = [
  { id: 'N-01', name: '네트워크 분리', items: 3, implementedItems: 2, status: 'partial' },  // 물리 망분리 1항목: 인프라 구성 시 충족
  { id: 'N-02', name: '데이터 등급 분류', items: 4, implementedItems: 4, status: 'pass' },
  { id: 'N-03', name: '접근 통제', items: 3, implementedItems: 3, status: 'pass' },
  { id: 'N-04', name: '인증 강화', items: 2, implementedItems: 2, status: 'pass' },
  { id: 'N-05', name: 'AI 연동 보안', items: 3, implementedItems: 3, status: 'pass' },
  { id: 'N-06', name: '감사 추적', items: 3, implementedItems: 3, status: 'pass' },
];

/**
 * FR-P14.1: CSAP 79항목 준수율 조회
 * GET /compliance/csap
 */
export async function csapComplianceHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const totalItems = 79; // CSAP 표준등급 13개 분야 79항목 (checklist-master.md 기준)

  const domainResults = CSAP_DOMAINS.map((domain) => ({
    id: domain.id,
    name: domain.name,
    totalItems: domain.items,
    passCount: domain.implementedItems,
    rate: Math.round((domain.implementedItems / domain.items) * 100),
  }));

  const totalPass = domainResults.reduce((sum, d) => sum + d.passCount, 0);

  await reply.send({
    totalItems,
    totalPass,
    complianceRate: Math.round((totalPass / totalItems) * 100),
    domains: domainResults,
    lastChecked: new Date().toISOString(),
  });
}

/**
 * FR-P14.2: N2SF 6영역 현황 조회
 * GET /compliance/n2sf
 */
export async function n2sfComplianceHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const totalItems = N2SF_DOMAINS.reduce((sum, d) => sum + d.items, 0);
  const totalPass = N2SF_DOMAINS.reduce((sum, d) => sum + d.implementedItems, 0);

  const domainResults = N2SF_DOMAINS.map((domain) => ({
    id: domain.id,
    name: domain.name,
    totalItems: domain.items,
    passCount: domain.implementedItems,
    rate: Math.round((domain.implementedItems / domain.items) * 100),
    status: domain.status,
  }));

  await reply.send({
    totalItems,
    totalPass,
    complianceRate: Math.round((totalPass / totalItems) * 100),
    domains: domainResults,
    lastChecked: new Date().toISOString(),
  });
}

/**
 * FR-P14.3: 감리 준비도 점수 계산
 * GET /compliance/readiness
 */
export async function readinessHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  // CSAP 동적 준수율 계산
  const csapTotalItems = CSAP_DOMAINS.reduce((sum, d) => sum + d.items, 0);
  const csapTotalPass = CSAP_DOMAINS.reduce((sum, d) => sum + d.implementedItems, 0);
  const csapRate = Math.round((csapTotalPass / csapTotalItems) * 100);

  // N2SF 동적 준수율 계산
  const n2sfTotalItems = N2SF_DOMAINS.reduce((sum, d) => sum + d.items, 0);
  const n2sfTotalPass = N2SF_DOMAINS.reduce((sum, d) => sum + d.implementedItems, 0);
  const n2sfRate = Math.round((n2sfTotalPass / n2sfTotalItems) * 100);

  // 문서 완비율 (PDCA 문서 기준 — 현재 Phase 1 완료 상태)
  const docCompleteness = 100;

  const readinessScore = Math.round(
    csapRate * 0.4 + n2sfRate * 0.3 + docCompleteness * 0.3,
  );

  await logComplianceEvent('READINESS_CHECK', { readinessScore });

  await reply.send({
    readinessScore,
    breakdown: {
      csapCompliance: { rate: csapRate, weight: 0.4 },
      n2sfCompliance: { rate: n2sfRate, weight: 0.3 },
      documentCompleteness: { rate: docCompleteness, weight: 0.3 },
    },
    recommendation:
      readinessScore >= 90
        ? '감리 대응 준비 완료'
        : readinessScore >= 70
          ? '일부 보완 후 감리 대응 가능'
          : '감리 대응 준비 미흡',
    lastChecked: new Date().toISOString(),
  });
}

/**
 * FR-P14.4: OpenTelemetry 메트릭 수집
 * GET /compliance/metrics
 */
export async function metricsHandler(
  _request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  await reply.send({
    service: 'compliance-service',
    uptime: process.uptime(),
    metrics: {
      csapCheckCount: 79,
      n2sfCheckCount: 18,
      lastCheckDuration: 0,
      checksPerMinute: 0,
    },
    timestamp: new Date().toISOString(),
  });
}
