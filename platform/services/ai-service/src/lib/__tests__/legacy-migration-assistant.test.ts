import { describe, it, expect } from 'vitest';
import { LegacyMigrationAssistant, type LegacyModule } from '../legacy-migration-assistant.js';

describe('LegacyMigrationAssistant', () => {
  const assistant = new LegacyMigrationAssistant();

  const modules: LegacyModule[] = [
    { id: 'm1', name: 'batch', language: 'cobol', linesOfCode: 20000, dependencies: [], hasTests: false, cyclomaticComplexity: 60 },
    { id: 'm2', name: 'util', language: 'java6', linesOfCode: 300, dependencies: [], hasTests: true, cyclomaticComplexity: 5 },
    { id: 'm3', name: 'web', language: 'asp_classic', linesOfCode: 5000, dependencies: [], hasTests: false, cyclomaticComplexity: 25 },
  ];

  it('위험도 분류 + 액션 결정', () => {
    const tasks = assistant.analyze(modules);
    const m1 = tasks.find((t) => t.moduleId === 'm1');
    expect(m1?.risk).toBe('high');
    expect(m1?.action).toBe('wrap');
  });

  it('작은 모듈은 retire', () => {
    const tasks = assistant.analyze(modules);
    const m2 = tasks.find((t) => t.moduleId === 'm2');
    expect(m2?.action).toBe('retire');
  });

  it('웨이브 스케줄링', () => {
    const tasks = assistant.analyze(modules);
    const plan = assistant.plan(tasks);
    expect(plan.waves.length).toBeGreaterThan(0);
    expect(plan.totalEffortDays).toBeGreaterThan(0);
  });

  it('진척도 계산', () => {
    const tasks = assistant.analyze(modules);
    const p = assistant.progress(tasks, ['m2']);
    expect(p.completed).toBe(1);
    expect(p.remaining).toBe(2);
  });

  it('빈 입력 거부', () => {
    expect(() => assistant.analyze([])).toThrow('MIGRATION_EMPTY');
  });
});
