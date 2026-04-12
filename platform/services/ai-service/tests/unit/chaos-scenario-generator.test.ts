// MTU-N377 단위 테스트
import { describe, it, expect } from 'vitest';
import {
  computeBlastRadius,
  generateScenarios,
  validateSafety,
  getChaosAuditLog,
  ChaosScenarioGeneratorService,
  type ServiceNode,
  type ChaosScenario,
} from '../../src/lib/chaos-scenario-generator';

const topology: ServiceNode[] = [
  { name: 'api', criticality: 'high', dependencies: [] },
  { name: 'web', criticality: 'medium', dependencies: ['api'] },
  { name: 'db', criticality: 'critical', dependencies: [] },
];

describe('MTU-N377 ChaosScenarioGenerator', () => {
  it('블라스트 반경 계산', () => {
    const blast = computeBlastRadius('api', topology);
    expect(blast).toContain('api');
    expect(blast).toContain('web');
  });

  it('독립 노드의 반경은 자기자신', () => {
    const blast = computeBlastRadius('db', topology);
    expect(blast.length).toBe(1);
  });

  it('시나리오 생성 - critical 제외', () => {
    const scs = generateScenarios('t1', topology);
    expect(scs.every((s) => s.target !== 'db')).toBe(true);
  });

  it('시나리오에 안전 가드 포함', () => {
    const scs = generateScenarios('t1', topology);
    expect(scs.every((s) => s.safetyGuards.length > 0)).toBe(true);
  });

  it('가설 문장 포함', () => {
    const scs = generateScenarios('t1', topology);
    expect(scs[0]?.hypothesis).toContain('회복');
  });

  it('안전 검증 - 정상', () => {
    const sc: ChaosScenario = {
      scenarioId: 'x',
      target: 'api',
      failureType: 'pod_kill',
      durationSec: 60,
      blastRadius: ['api'],
      safetyGuards: ['g1'],
      hypothesis: 'h',
    };
    expect(validateSafety(sc, 5).safe).toBe(true);
  });

  it('안전 검증 - 블라스트 반경 초과', () => {
    const sc: ChaosScenario = {
      scenarioId: 'x',
      target: 'api',
      failureType: 'pod_kill',
      durationSec: 60,
      blastRadius: ['a', 'b', 'c', 'd', 'e', 'f'],
      safetyGuards: ['g1'],
      hypothesis: 'h',
    };
    expect(validateSafety(sc, 5).safe).toBe(false);
  });

  it('안전 검증 - 가드 없음', () => {
    const sc: ChaosScenario = {
      scenarioId: 'x',
      target: 'api',
      failureType: 'pod_kill',
      durationSec: 60,
      blastRadius: ['api'],
      safetyGuards: [],
      hypothesis: 'h',
    };
    expect(validateSafety(sc, 5).safe).toBe(false);
  });

  it('안전 검증 - 실행시간 초과', () => {
    const sc: ChaosScenario = {
      scenarioId: 'x',
      target: 'api',
      failureType: 'pod_kill',
      durationSec: 700,
      blastRadius: ['api'],
      safetyGuards: ['g1'],
      hypothesis: 'h',
    };
    expect(validateSafety(sc, 5).safe).toBe(false);
  });

  it('서비스 클래스', () => {
    const svc = new ChaosScenarioGeneratorService('t2');
    const scs = svc.generate(topology);
    expect(scs.length).toBeGreaterThan(0);
  });

  it('감사 로그 테넌트 격리', () => {
    generateScenarios('tA', topology);
    generateScenarios('tB', topology);
    expect(getChaosAuditLog('tA').every((e) => e.tenantId === 'tA')).toBe(true);
  });
});
