// Design Ref: MTU-N475 §RPA 봇 생성기
// Plan SC: FR-RPA.1~5

export type ActionType = 'click' | 'type' | 'read' | 'api-call' | 'wait' | 'condition';

export interface BotAction {
  id: string;
  type: ActionType;
  target: string;
  params?: Record<string, string | number>;
  onError?: 'retry' | 'abort' | 'skip';
}

export interface BotProcess {
  id: string;
  name: string;
  actions: BotAction[];
  edges: Array<{ from: string; to: string }>;
}

export interface ExecutionResult {
  processId: string;
  status: 'success' | 'failed' | 'partial';
  executedActions: number;
  errors: string[];
}

export interface ExecutionLogEntry {
  processId: string;
  actionId: string;
  status: 'ok' | 'error';
  at: string;
  detail?: string;
}

export class RpaAiBuilder {
  private processes = new Map<string, BotProcess>();
  private log: ExecutionLogEntry[] = [];

  /** FR-RPA.1 프로세스 그래프 등록 */
  registerProcess(process: BotProcess): BotProcess {
    this.processes.set(process.id, process);
    return process;
  }

  /** FR-RPA.2 액션 카탈로그 */
  getActionCatalog(): ActionType[] {
    return ['click', 'type', 'read', 'api-call', 'wait', 'condition'];
  }

  /** FR-RPA.3 실행 엔진 */
  execute(processId: string, executor: (action: BotAction) => boolean): ExecutionResult {
    const p = this.processes.get(processId);
    if (!p) throw new Error('프로세스 없음');
    let executed = 0;
    const errors: string[] = [];
    for (const action of p.actions) {
      try {
        const ok = executor(action);
        this.appendLog({ processId, actionId: action.id, status: ok ? 'ok' : 'error', at: new Date().toISOString() });
        if (ok) executed++;
        else {
          errors.push(`${action.id} 실패`);
          if (action.onError === 'abort') break;
          if (action.onError === 'retry') {
            const retry = executor(action);
            if (retry) executed++;
          }
        }
      } catch (e) {
        errors.push(`${action.id} 예외`);
        if (action.onError === 'abort') break;
      }
    }
    return {
      processId,
      status: errors.length === 0 ? 'success' : executed > 0 ? 'partial' : 'failed',
      executedActions: executed,
      errors,
    };
  }

  /** FR-RPA.4 예외 처리 (재시도 지원) */
  setErrorPolicy(processId: string, actionId: string, policy: BotAction['onError']): void {
    const p = this.processes.get(processId);
    if (!p) return;
    const a = p.actions.find((x) => x.id === actionId);
    if (a) a.onError = policy;
  }

  /** FR-RPA.5 실행 이력 감사 */
  getExecutionLog(processId?: string): ExecutionLogEntry[] {
    return processId ? this.log.filter((e) => e.processId === processId) : [...this.log];
  }

  private appendLog(entry: ExecutionLogEntry): void {
    this.log.push(entry);
  }
}

export const rpaAiBuilder = new RpaAiBuilder();
