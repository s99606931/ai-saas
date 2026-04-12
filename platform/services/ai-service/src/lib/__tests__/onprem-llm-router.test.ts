import { describe, it, expect } from 'vitest';
import { OnpremLlmRouter, type ModelProfile, type RouteRequest } from '../onprem-llm-router';

describe('OnpremLlmRouter', () => {
  const svc = new OnpremLlmRouter();

  const models: ModelProfile[] = [
    {
      modelId: 'llama-3-local',
      location: 'local',
      contextWindow: 8192,
      costPer1kTokenKrw: 0,
      avgLatencyMs: 500,
      supportedLanguages: ['ko', 'en'],
    },
    {
      modelId: 'claude-opus-cloud',
      location: 'cloud',
      contextWindow: 200_000,
      costPer1kTokenKrw: 30,
      avgLatencyMs: 1500,
      supportedLanguages: ['ko', 'en'],
    },
  ];

  it('allows cloud only for O grade', () => {
    expect(svc.allowedLocations('O')).toContain('cloud');
    expect(svc.allowedLocations('C')).not.toContain('cloud');
    expect(svc.allowedLocations('S')).not.toContain('cloud');
  });

  it('routes C grade to local only', () => {
    const req: RouteRequest = { dataGrade: 'C', requiredContextTokens: 4000, language: 'ko' };
    const decision = svc.route(models, req);
    expect(decision.location).toBe('local');
  });

  it('routes O grade to best score', () => {
    const req: RouteRequest = { dataGrade: 'O', requiredContextTokens: 4000, language: 'ko' };
    const decision = svc.route(models, req);
    expect(decision.modelId).toBe('llama-3-local');
  });

  it('throws when no model matches context window', () => {
    const req: RouteRequest = { dataGrade: 'C', requiredContextTokens: 100_000, language: 'ko' };
    expect(() => svc.route(models, req)).toThrow();
  });

  it('creates audit entry', () => {
    const req: RouteRequest = { dataGrade: 'C', requiredContextTokens: 4000, language: 'ko' };
    const decision = svc.route(models, req);
    const audit = svc.auditDecision(req, decision, '2026-04-12T00:00:00Z');
    expect(audit.dataGrade).toBe('C');
    expect(audit.allowedLocations).toEqual(['local']);
  });
});
