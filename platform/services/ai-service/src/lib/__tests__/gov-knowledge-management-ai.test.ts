import { describe, it, expect, beforeEach } from 'vitest';
import { GovKnowledgeManagementAI, type KnowledgeDoc } from '../gov-knowledge-management-ai';

describe('GovKnowledgeManagementAI (R600 이정표)', () => {
  let ai: GovKnowledgeManagementAI;

  const doc = (id: string, body: string, overrides: Partial<KnowledgeDoc> = {}): KnowledgeDoc => ({
    docId: id,
    title: `제목 ${id}`,
    body,
    author: '김공공',
    department: '정책기획',
    createdAt: '2025-01-01T00:00:00Z',
    tags: ['정책', '기획'],
    category: 'policy',
    accessCount: 10,
    ...overrides,
  });

  beforeEach(() => {
    ai = new GovKnowledgeManagementAI();
  });

  it('R600 이정표 식별자 노출', () => {
    expect(ai.milestoneRound).toBe(600);
  });

  it('문서 추가 후 검색 결과 반환', () => {
    ai.addDoc(doc('D1', '행정정책 개선 방안 보고서 2026'));
    ai.addDoc(doc('D2', '복지 지원금 지급 절차 매뉴얼'));
    const res = ai.search('행정정책');
    expect(res[0]?.docId).toBe('D1');
  });

  it('인기도 보정 적용', () => {
    ai.addDoc(doc('D3', '공공데이터 개방 정책', { accessCount: 10 }));
    ai.addDoc(doc('D4', '공공데이터 개방 정책', { docId: 'D4', accessCount: 2000 }));
    const res = ai.search('공공데이터');
    expect(res[0]?.docId).toBe('D4');
  });

  it('부서별 보고서 — 카테고리 집계', () => {
    ai.addDoc(doc('A1', '...', { department: '재무', category: 'report' }));
    ai.addDoc(doc('A2', '...', { department: '재무', category: 'memo' }));
    const rep = ai.reportByDepartment('재무', '2026-04-13T00:00:00Z');
    expect(rep.totalDocs).toBe(2);
    expect(rep.byCategory.report).toBe(1);
    expect(rep.byCategory.memo).toBe(1);
  });

  it('2년 이상 미접근 문서는 stale', () => {
    ai.addDoc(doc('A3', 'old', {
      department: '총무',
      createdAt: '2022-01-01T00:00:00Z',
      accessCount: 0,
    }));
    const rep = ai.reportByDepartment('총무', '2026-04-13T00:00:00Z');
    expect(rep.staleDocs).toBe(1);
  });

  it('작성자 지식 보존 조회', () => {
    ai.addDoc(doc('P1', 'x', { author: '이퇴임' }));
    ai.addDoc(doc('P2', 'y', { author: '이퇴임' }));
    ai.addDoc(doc('P3', 'z', { author: '타인' }));
    const preserved = ai.preserveKnowledge('이퇴임');
    expect(preserved).toHaveLength(2);
  });
});
