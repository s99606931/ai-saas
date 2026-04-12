import { describe, it, expect } from 'vitest';
import { ProjectProgressMonitor, type WbsTask } from '../project-progress-monitor';

describe('ProjectProgressMonitor', () => {
  const svc = new ProjectProgressMonitor();

  const tasks: WbsTask[] = [
    {
      taskId: 'T1',
      name: '설계',
      plannedStart: '2026-01-01',
      plannedEnd: '2026-03-01',
      plannedCostKrw: 10_000_000,
      actualCostKrw: 12_000_000,
      percentComplete: 100,
    },
    {
      taskId: 'T2',
      name: '구현',
      plannedStart: '2026-03-01',
      plannedEnd: '2026-06-01',
      plannedCostKrw: 30_000_000,
      actualCostKrw: 15_000_000,
      percentComplete: 50,
    },
  ];

  it('loads wbs', () => {
    const loaded = svc.loadWbs(tasks);
    expect(loaded.length).toBe(2);
  });

  it('computes EVM metrics', () => {
    const evm = svc.computeEvm(tasks);
    expect(evm.pv).toBe(40_000_000);
    expect(evm.ev).toBe(25_000_000);
    expect(evm.ac).toBe(27_000_000);
    expect(evm.cpi).toBeLessThan(1);
  });

  it('detects cost deviations', () => {
    const devs = svc.detectDeviations(tasks);
    const t1 = devs.find((d) => d.taskId === 'T1');
    expect(t1?.severity).toBe('warn');
  });

  it('forecasts completion date', () => {
    const t = tasks[1]!;
    const forecast = svc.forecastCompletion(t, '2026-04-15');
    expect(forecast.forecastedEndDate).toBeDefined();
  });

  it('alerts critical when cpi low', () => {
    const evm = { pv: 100, ev: 50, ac: 80, cpi: 0.625, spi: 0.5 };
    const alert = svc.alert(evm, 'P1');
    expect(alert.level).toBe('critical');
  });
});
