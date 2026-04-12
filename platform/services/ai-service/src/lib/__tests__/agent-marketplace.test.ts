import { describe, it, expect, beforeEach } from 'vitest';
import { AgentMarketplace } from '../agent-marketplace.js';

describe('AgentMarketplace', () => {
  let market: AgentMarketplace;

  beforeEach(() => {
    market = new AgentMarketplace();
    market.registerOwner('owner-1');
  });

  const base = {
    name: 'Doc Summarizer',
    description: '공공 문서 요약 에이전트',
    version: '1.0.0',
    provider: 'gov-lab',
    tags: ['summary', 'doc'],
    skills: ['summarize'],
    endpointUrl: 'https://agent.example.kr/run',
    signature: 'a'.repeat(40),
  };

  it('등록 시 pending 상태로 저장', () => {
    const agent = market.register('owner-1', base);
    expect(agent.status).toBe('pending');
    expect(agent.executionCount).toBe(0);
  });

  it('권한 없는 소유자 등록 거부', () => {
    expect(() => market.register('stranger', base)).toThrow('MARKET_OWNER_FORBIDDEN');
  });

  it('승인 후 실행 가능', async () => {
    const agent = market.register('owner-1', base);
    market.approve(agent.id, 'owner-1');
    const rec = await market.execute(agent.id, 'user-1', {}, { tokensEstimated: 100, maxTokens: 500 });
    expect(rec.status).toBe('running');
  });

  it('승인 전 실행 차단', async () => {
    const agent = market.register('owner-1', base);
    await expect(
      market.execute(agent.id, 'user-1', {}, { tokensEstimated: 10, maxTokens: 100 }),
    ).rejects.toThrow('MARKET_AGENT_NOT_APPROVED');
  });

  it('쿼터 초과 실행 거부', async () => {
    const agent = market.register('owner-1', base);
    market.approve(agent.id, 'owner-1');
    await expect(
      market.execute(agent.id, 'user-1', {}, { tokensEstimated: 1000, maxTokens: 500 }),
    ).rejects.toThrow('MARKET_QUOTA_EXCEEDED');
  });

  it('태그 검색 동작', () => {
    const a = market.register('owner-1', base);
    market.approve(a.id, 'owner-1');
    const results = market.search({ tags: ['summary'], status: 'approved' });
    expect(results).toHaveLength(1);
  });

  it('사용량 집계', async () => {
    const agent = market.register('owner-1', base);
    market.approve(agent.id, 'owner-1');
    const rec = await market.execute(agent.id, 'user-1', {}, { tokensEstimated: 50, maxTokens: 500 });
    market.completeExecution(rec.id, 80, 12);
    const usage = market.usage(agent.id);
    expect(usage.totalCalls).toBe(1);
    expect(usage.totalTokens).toBe(80);
    expect(usage.totalCostKrw).toBe(12);
  });

  it('정지/폐기 라이프사이클', () => {
    const agent = market.register('owner-1', base);
    market.approve(agent.id, 'owner-1');
    market.suspend(agent.id, '정책 위반');
    expect(market.search({ status: 'suspended' })).toHaveLength(1);
    market.retire(agent.id);
    expect(market.search({ status: 'retired' })).toHaveLength(1);
  });
});
