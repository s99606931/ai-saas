// Plan SC: FR-R76.1~5 / Design Ref: SVC-AI-ADV-R76.design.md
import { describe, it, expect } from 'vitest';
import {
  AgentDryRunSimulator,
  createAgentDryRunSimulator,
  type ToolMeta,
  type DryRunPlan,
} from '../agent-dry-run-simulator';

const tools: ToolMeta[] = [
  { name: 'db.read', sideEffects: ['read'], riskWeight: 0.1, grade: 'O' },
  { name: 'db.write', sideEffects: ['write'], riskWeight: 0.8, grade: 'O' },
  { name: 'http.fetch', sideEffects: ['network'], riskWeight: 0.4, grade: 'O' },
  { name: 'fs.delete', sideEffects: ['delete'], riskWeight: 0.9, grade: 'O' },
  { name: 'secure.read', sideEffects: ['read'], riskWeight: 0.2, grade: 'C' },
];

function makePlan(toolNames: string[]): DryRunPlan {
  return {
    planId: 'p-1',
    steps: toolNames.map((t, i) => ({
      stepId: `s${i + 1}`,
      tool: t,
      args: {},
    })),
  };
}

describe('AgentDryRunSimulator', () => {
  it('FR-R76.1: registers tools with side-effect metadata', () => {
    const sim = new AgentDryRunSimulator();
    sim.registerTool(tools[0]!);
    const report = sim.simulate(makePlan(['db.read']));
    expect(report.effects.read).toBe(1);
    expect(report.blocked).toBe(false);
  });

  it('FR-R76.2: detects unknown tools and blocks', () => {
    const sim = createAgentDryRunSimulator(tools);
    const report = sim.simulate(makePlan(['unknown.tool']));
    expect(report.blocked).toBe(true);
    expect(report.blockedReason).toContain('Unknown');
    expect(sim.getAuditLog().some((e) => e.action === 'UNKNOWN_TOOL')).toBe(true);
  });

  it('FR-R76.3: aggregates side-effects across steps', () => {
    const sim = createAgentDryRunSimulator(tools);
    const report = sim.simulate(
      makePlan(['db.read', 'http.fetch', 'db.write']),
    );
    expect(report.effects.read).toBe(1);
    expect(report.effects.network).toBe(1);
    expect(report.effects.write).toBe(1);
    expect(report.totalSteps).toBe(3);
  });

  it('FR-R76.4: computes risk score and flags high-risk steps', () => {
    const sim = createAgentDryRunSimulator(tools);
    const report = sim.simulate(makePlan(['db.write', 'fs.delete']));
    expect(report.riskScore).toBeGreaterThanOrEqual(0.7);
    expect(report.highRiskSteps).toContain('s1');
    expect(report.highRiskSteps).toContain('s2');
    const log = sim.getAuditLog();
    expect(log.some((e) => e.action === 'RISK_HIGH')).toBe(true);
  });

  it('FR-R76.4: N2SF C/S grade tool blocks simulation', () => {
    const sim = createAgentDryRunSimulator(tools);
    const report = sim.simulate(makePlan(['db.read', 'secure.read']));
    expect(report.blocked).toBe(true);
    expect(report.blockedReason).toContain('C');
    const log = sim.getAuditLog();
    expect(log.some((e) => e.action === 'BLOCKED' && e.grade === 'C')).toBe(true);
  });

  it('FR-R76.5: audit log records SIMULATE for every run', () => {
    const sim = createAgentDryRunSimulator(tools);
    sim.simulate(makePlan(['db.read']));
    sim.simulate(makePlan(['http.fetch']));
    const sims = sim.getAuditLog().filter((e) => e.action === 'SIMULATE');
    expect(sims.length).toBe(2);
  });

  it('rejects invalid tool metadata', () => {
    const sim = new AgentDryRunSimulator();
    expect(() =>
      sim.registerTool({ name: 'x', sideEffects: [], riskWeight: 2 }),
    ).toThrow();
  });
});
