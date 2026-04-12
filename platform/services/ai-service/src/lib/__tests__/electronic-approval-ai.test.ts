// MTU-N281 전자결재 AI 어시스턴트 테스트
// Design Ref: MTU-N281 | Plan SC: SC-1~SC-4

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateDraftDocument,
  recommendApprovalLine,
  reviewDraftDocument,
  createApprovalTemplate,
  getApprovalTemplate,
  listApprovalTemplates,
  deleteApprovalTemplate,
  addApprovalHistory,
  getApprovalAuditLog,
  ElectronicApprovalAIService,
} from '../electronic-approval-ai.js';

describe('MTU-N281 ElectronicApprovalAIService', () => {
  const tenantId = 'tenant-n281-test';

  it('FR-N281.1: 기안문 자동 생성 + PII 마스킹', () => {
    const r = generateDraftDocument({
      tenantId,
      userId: 'u1',
      documentType: 'internal_report',
      subject: '예산 집행 현황 (담당자 010-1234-5678)',
      keywords: ['1분기', '운영비'],
      urgency: 'normal',
    });
    expect(r.documentId).toMatch(/^doc-/);
    expect(r.title).toContain('[전화번호-마스킹]');
    expect(r.body).toContain('현황');
    expect(r.confidenceScore).toBeGreaterThan(0.5);
  });

  it('FR-N281.2: 결재선 추천 (기본)', () => {
    const r = recommendApprovalLine(tenantId, 'u1', '재무팀', 'expense_request', 'normal');
    expect(r.recommendationId).toMatch(/^rec-/);
    expect(r.approvalLine.length).toBeGreaterThanOrEqual(3);
    expect(r.lineType).toBe('sequential');
    expect(r.confidenceScore).toBeGreaterThan(0);
  });

  it('FR-N281.2: 긴급 시 병렬 결재선', () => {
    const r = recommendApprovalLine(tenantId, 'u1', '재무팀', 'expense_request', 'emergency');
    expect(r.lineType).toBe('parallel');
  });

  it('FR-N281.3: 템플릿 CRUD', () => {
    const t = createApprovalTemplate(tenantId, '월간보고', 'internal_report', [
      { sectionId: 's1', title: '제목', placeholder: '제목 입력', required: true, order: 1 },
      { sectionId: 's2', title: '내용', placeholder: '내용 입력', required: true, order: 2 },
    ]);
    expect(t.templateId).toMatch(/^tpl-/);
    expect(getApprovalTemplate(t.templateId)).toBeDefined();
    expect(listApprovalTemplates(tenantId).some((x) => x.templateId === t.templateId)).toBe(true);
    expect(deleteApprovalTemplate(tenantId, t.templateId)).toBe(true);
  });

  it('FR-N281.4: 기안문 검토 (용어 교정)', () => {
    const suggestions = reviewDraftDocument(
      tenantId,
      'u1',
      'doc-test',
      '상기 내용과 같이 검토바랍니다',
      'general',
    );
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.type === 'terminology')).toBe(true);
  });

  it('FR-N281.4: 부적절한 문체 검출', () => {
    const r = reviewDraftDocument(tenantId, 'u1', 'doc-test', '확인 부탁드립니다!', 'general');
    expect(r.some((s) => s.type === 'tone')).toBe(true);
  });

  it('FR-N281.5: 결재 이력 패턴 학습', () => {
    addApprovalHistory({
      historyId: 'h1',
      documentType: 'internal_report',
      department: '학습테스트부',
      approvalLine: [
        { userId: 'u1', name: '기안', position: '담당', department: '학습테스트부', role: 'drafter', order: 1 },
        { userId: 'u2', name: '팀장', position: '팀장', department: '학습테스트부', role: 'approver', order: 2 },
      ],
      result: 'approved',
      processedAt: new Date().toISOString(),
    });
    addApprovalHistory({
      historyId: 'h2',
      documentType: 'internal_report',
      department: '학습테스트부',
      approvalLine: [
        { userId: 'u1', name: '기안', position: '담당', department: '학습테스트부', role: 'drafter', order: 1 },
        { userId: 'u2', name: '팀장', position: '팀장', department: '학습테스트부', role: 'approver', order: 2 },
      ],
      result: 'approved',
      processedAt: new Date().toISOString(),
    });
    addApprovalHistory({
      historyId: 'h3',
      documentType: 'internal_report',
      department: '학습테스트부',
      approvalLine: [
        { userId: 'u1', name: '기안', position: '담당', department: '학습테스트부', role: 'drafter', order: 1 },
        { userId: 'u2', name: '팀장', position: '팀장', department: '학습테스트부', role: 'approver', order: 2 },
      ],
      result: 'approved',
      processedAt: new Date().toISOString(),
    });
    const r = recommendApprovalLine(tenantId, 'u1', '학습테스트부', 'internal_report', 'normal');
    expect(r.confidenceScore).toBeGreaterThan(0.85);
  });

  it('FR-N281.6: 감사 로그 전수 기록', () => {
    const before = getApprovalAuditLog(tenantId).length;
    generateDraftDocument({
      tenantId,
      userId: 'u-audit',
      documentType: 'general',
      subject: '감사 테스트',
      keywords: ['확인'],
      urgency: 'normal',
    });
    const after = getApprovalAuditLog(tenantId).length;
    expect(after).toBeGreaterThan(before);
  });

  describe('Service 통합', () => {
    let svc: ElectronicApprovalAIService;
    beforeEach(() => {
      svc = new ElectronicApprovalAIService('tenant-svc-n281');
    });

    it('Service 통합 워크플로우', () => {
      const draft = svc.generateDraft({
        userId: 'u1',
        documentType: 'general',
        subject: '서비스 통합 테스트',
        keywords: ['e2e'],
        urgency: 'normal',
      });
      expect(draft.documentId).toBeDefined();

      const line = svc.recommendLine('u1', '테스트팀', 'general');
      expect(line.approvalLine.length).toBeGreaterThan(0);

      const review = svc.review('u1', draft.documentId, draft.body, 'general');
      expect(Array.isArray(review)).toBe(true);

      const log = svc.getAuditLog();
      expect(log.length).toBeGreaterThan(0);
    });
  });
});
