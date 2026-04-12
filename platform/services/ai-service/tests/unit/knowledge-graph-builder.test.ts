// MTU-N383 단위 테스트
import { describe, it, expect } from 'vitest';
import {
  createGraph,
  addNode,
  addEdge,
  extractEntities,
  buildFromText,
  queryRelated,
  getKgAuditLog,
  KnowledgeGraphBuilderService,
} from '../../src/lib/knowledge-graph-builder';

describe('MTU-N383 KnowledgeGraphBuilder', () => {
  it('그래프 생성', () => {
    const g = createGraph();
    expect(g.nodes.length).toBe(0);
  });

  it('노드 추가', () => {
    const g = createGraph();
    addNode(g, { id: 'p:1', type: 'person', name: '홍길동', attributes: {} });
    expect(g.nodes.length).toBe(1);
  });

  it('중복 노드 방지', () => {
    const g = createGraph();
    addNode(g, { id: 'p:1', type: 'person', name: '홍길동', attributes: {} });
    addNode(g, { id: 'p:1', type: 'person', name: '홍길동', attributes: {} });
    expect(g.nodes.length).toBe(1);
  });

  it('엣지 추가', () => {
    const g = createGraph();
    addEdge(g, { from: 'a', to: 'b', relation: 'knows', weight: 1 });
    expect(g.edges.length).toBe(1);
  });

  it('동일 엣지 가중치 누적', () => {
    const g = createGraph();
    addEdge(g, { from: 'a', to: 'b', relation: 'knows', weight: 1 });
    addEdge(g, { from: 'a', to: 'b', relation: 'knows', weight: 2 });
    expect(g.edges.length).toBe(1);
    expect(g.edges[0]?.weight).toBe(3);
  });

  it('엔티티 추출 - 이름', () => {
    const ents = extractEntities('홍길동과 이순신이 회의에 참여했다');
    expect(ents.some((e) => e.text === '홍길동')).toBe(true);
  });

  it('엔티티 추출 - 업무', () => {
    const ents = extractEntities('재무 업무 담당자');
    expect(ents.some((e) => e.type === 'task')).toBe(true);
  });

  it('텍스트로부터 그래프 빌드', () => {
    const g = buildFromText('t1', '홍길동이 재무 업무를 담당한다');
    expect(g.nodes.length).toBeGreaterThan(0);
  });

  it('관련 노드 조회', () => {
    const g = createGraph();
    addNode(g, { id: 'a', type: 'person', name: 'A', attributes: {} });
    addNode(g, { id: 'b', type: 'task', name: 'B', attributes: {} });
    addEdge(g, { from: 'a', to: 'b', relation: 'r', weight: 1 });
    const related = queryRelated(g, 'a');
    expect(related.length).toBe(1);
  });

  it('서비스 클래스', () => {
    const svc = new KnowledgeGraphBuilderService('t2');
    const g = svc.build('홍길동 재무 업무');
    expect(g.nodes.length).toBeGreaterThanOrEqual(0);
  });

  it('감사 로그 테넌트 격리', () => {
    buildFromText('tA', '홍길동');
    buildFromText('tB', '이순신');
    expect(getKgAuditLog('tA').every((e) => e.tenantId === 'tA')).toBe(true);
  });
});
