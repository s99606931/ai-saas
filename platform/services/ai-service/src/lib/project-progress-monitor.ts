// Design Ref: MTU-N438 §사업 진행률 모니터
// Plan SC: FR-N438.1~5

export interface WbsTask {
  taskId: string;
  name: string;
  plannedStart: string;
  plannedEnd: string;
  plannedCostKrw: number;
  actualCostKrw: number;
  percentComplete: number;
}

export interface EvmMetrics {
  pv: number;
  ev: number;
  ac: number;
  cpi: number;
  spi: number;
}

export interface CostDeviation {
  taskId: string;
  deviation: number;
  severity: 'ok' | 'warn' | 'critical';
}

export interface CompletionForecast {
  taskId: string;
  forecastedEndDate: string;
  daysSlip: number;
}

export type AlertLevel = 'info' | 'warn' | 'critical';

export interface ProgressAlert {
  projectId: string;
  level: AlertLevel;
  message: string;
}

export class ProjectProgressMonitor {
  /** FR-N438.1 WBS 수집/정규화 */
  loadWbs(tasks: WbsTask[]): WbsTask[] {
    return tasks.filter((t) => t.taskId && t.plannedCostKrw >= 0);
  }

  /** FR-N438.2 EVM 계산 */
  computeEvm(tasks: WbsTask[]): EvmMetrics {
    let pv = 0;
    let ev = 0;
    let ac = 0;
    for (const t of tasks) {
      pv += t.plannedCostKrw;
      ev += t.plannedCostKrw * (t.percentComplete / 100);
      ac += t.actualCostKrw;
    }
    const cpi = ac === 0 ? 1 : ev / ac;
    const spi = pv === 0 ? 1 : ev / pv;
    return {
      pv: +pv.toFixed(2),
      ev: +ev.toFixed(2),
      ac: +ac.toFixed(2),
      cpi: +cpi.toFixed(3),
      spi: +spi.toFixed(3),
    };
  }

  /** FR-N438.3 원가 이탈 탐지 */
  detectDeviations(tasks: WbsTask[]): CostDeviation[] {
    return tasks.map((t) => {
      const planned = t.plannedCostKrw * (t.percentComplete / 100);
      const deviation = planned === 0 ? 0 : (t.actualCostKrw - planned) / Math.max(1, planned);
      let severity: CostDeviation['severity'] = 'ok';
      if (deviation > 0.3) severity = 'critical';
      else if (deviation > 0.1) severity = 'warn';
      return { taskId: t.taskId, deviation: +deviation.toFixed(3), severity };
    });
  }

  /** FR-N438.4 완료일 예측 */
  forecastCompletion(task: WbsTask, today: string): CompletionForecast {
    const plannedEnd = new Date(task.plannedEnd).getTime();
    const plannedStart = new Date(task.plannedStart).getTime();
    const now = new Date(today).getTime();
    if (task.percentComplete >= 100) {
      return { taskId: task.taskId, forecastedEndDate: today, daysSlip: 0 };
    }
    if (task.percentComplete === 0) {
      return {
        taskId: task.taskId,
        forecastedEndDate: task.plannedEnd,
        daysSlip: 0,
      };
    }
    const elapsed = now - plannedStart;
    const velocity = task.percentComplete / Math.max(1, elapsed);
    const remaining = (100 - task.percentComplete) / velocity;
    const forecastedMs = now + remaining;
    const daysSlip = Math.round((forecastedMs - plannedEnd) / (1000 * 60 * 60 * 24));
    return {
      taskId: task.taskId,
      forecastedEndDate: new Date(forecastedMs).toISOString().slice(0, 10),
      daysSlip,
    };
  }

  /** FR-N438.5 경보 등급 */
  alert(evm: EvmMetrics, projectId: string): ProgressAlert {
    if (evm.cpi < 0.8 || evm.spi < 0.8) {
      return { projectId, level: 'critical', message: `CPI=${evm.cpi}, SPI=${evm.spi} — 중대 이탈` };
    }
    if (evm.cpi < 0.95 || evm.spi < 0.95) {
      return { projectId, level: 'warn', message: `CPI=${evm.cpi}, SPI=${evm.spi} — 이탈 주의` };
    }
    return { projectId, level: 'info', message: '정상 진행' };
  }
}

export const projectProgressMonitor = new ProjectProgressMonitor();
