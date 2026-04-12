// MTU-N383 지식 그래프 빌더 테스트
import { describe, it, expect } from 'vitest';
import { KnowledgeGraphBuilderService } from '../knowledge-graph-builder.js';

describe('MTU-N383 KnowledgeGraphBuilder', () => {
  const svc = new KnowledgeGraphBuilderService('tenant-n383');

  it('FR-N383.1: 텍스트에서 그래프 구축', () => {
    const graph = svc.build('홍길동은 보고서 업무를 담당합니다. 이순신도 회의 업무에 참여합니다.');
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.edges.length).toBeGreaterThan(0);
  });

  it('FR-N383.2: 관계 질의', () => {
    svc.build('강감찬은 기획 업무를 담당합니다.');
    const related = svc.query('person:강감찬', 1);
    expect(related.length).toBeGreaterThan(0);
  });

  it('FR-N383.3: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
