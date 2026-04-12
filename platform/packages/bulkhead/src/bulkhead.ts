// Bulkhead -- 그룹 격리 실행기
// Design Ref: SVC-BULKHEAD-R41 DESIGN
// Plan SC: FR-BH.1~FR-BH.6
// CSAP: D-14 가용성, N2SF N-03 격리

export interface GroupConfig {
  /** 동시 실행 최대 개수 */
  maxConcurrent: number;
  /** 대기 큐 최대 길이 */
  maxQueue: number;
}

export interface GroupMetrics {
  accepted: number;
  rejected: number;
  queued: number;
  active: number;
  waiting: number;
}

interface Waiter<T> {
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
  run: () => Promise<T>;
}

interface GroupState {
  config: GroupConfig;
  active: number;
  waiting: Waiter<unknown>[];
  accepted: number;
  rejected: number;
  queued: number;
}

export class BulkheadRejectedError extends Error {
  readonly code = 'BULKHEAD_REJECTED';
  constructor(public readonly group: string, message: string) {
    super(message);
    this.name = 'BulkheadRejectedError';
  }
}

export class BulkheadGroupNotFoundError extends Error {
  readonly code = 'BULKHEAD_GROUP_NOT_FOUND';
}

/**
 * Bulkhead -- 그룹별 리소스 격리
 *
 * Plan SC: FR-BH.1~FR-BH.6
 */
export class Bulkhead {
  private readonly groups = new Map<string, GroupState>();

  /**
   * 그룹 추가 또는 재설정
   * Plan SC: FR-BH.5
   */
  addGroup(name: string, config: GroupConfig): void {
    if (config.maxConcurrent < 1) {
      throw new Error('maxConcurrent는 1 이상이어야 합니다.');
    }
    if (config.maxQueue < 0) {
      throw new Error('maxQueue는 0 이상이어야 합니다.');
    }

    const existing = this.groups.get(name);
    if (existing) {
      existing.config = config;
    } else {
      this.groups.set(name, {
        config,
        active: 0,
        waiting: [],
        accepted: 0,
        rejected: 0,
        queued: 0,
      });
    }
  }

  /**
   * 그룹 제거 (대기 중 작업 거부)
   * Plan SC: FR-BH.5
   */
  removeGroup(name: string): boolean {
    const group = this.groups.get(name);
    if (!group) return false;
    for (const waiter of group.waiting) {
      waiter.reject(
        new BulkheadRejectedError(name, `그룹이 제거되어 작업이 취소되었습니다: ${name}`),
      );
    }
    return this.groups.delete(name);
  }

  /**
   * 그룹에서 작업 실행
   * Plan SC: FR-BH.1, FR-BH.2, FR-BH.3
   */
  execute<T>(groupName: string, fn: () => Promise<T>): Promise<T> {
    const group = this.groups.get(groupName);
    if (!group) {
      return Promise.reject(
        new BulkheadGroupNotFoundError(`그룹을 찾을 수 없습니다: ${groupName}`),
      );
    }

    return new Promise<T>((resolve, reject) => {
      // 즉시 실행 가능
      if (group.active < group.config.maxConcurrent) {
        group.accepted++;
        void this.runTask(groupName, group, fn, resolve as (v: unknown) => void, reject);
        return;
      }

      // 큐 공간 있음
      if (group.waiting.length < group.config.maxQueue) {
        group.queued++;
        group.waiting.push({
          run: fn as () => Promise<unknown>,
          resolve: resolve as (v: unknown) => void,
          reject,
        });
        return;
      }

      // 큐 풀림 → 거부
      group.rejected++;
      reject(
        new BulkheadRejectedError(
          groupName,
          `그룹 '${groupName}'이 포화 상태입니다. (active=${group.active}, queue=${group.waiting.length})`,
        ),
      );
    });
  }

  private async runTask<T>(
    groupName: string,
    group: GroupState,
    fn: () => Promise<T>,
    resolve: (value: unknown) => void,
    reject: (reason: unknown) => void,
  ): Promise<void> {
    group.active++;
    try {
      const result = await fn();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      group.active--;
      this.drainQueue(groupName, group);
    }
  }

  private drainQueue(groupName: string, group: GroupState): void {
    while (group.active < group.config.maxConcurrent && group.waiting.length > 0) {
      const waiter = group.waiting.shift()!;
      group.accepted++;
      void this.runTask(groupName, group, waiter.run, waiter.resolve, waiter.reject);
    }
  }

  /**
   * 그룹 상태 조회
   * Plan SC: FR-BH.4
   */
  getMetrics(groupName: string): GroupMetrics {
    const group = this.groups.get(groupName);
    if (!group) {
      throw new BulkheadGroupNotFoundError(`그룹을 찾을 수 없습니다: ${groupName}`);
    }
    return {
      accepted: group.accepted,
      rejected: group.rejected,
      queued: group.queued,
      active: group.active,
      waiting: group.waiting.length,
    };
  }

  listGroups(): string[] {
    return Array.from(this.groups.keys());
  }

  hasGroup(name: string): boolean {
    return this.groups.has(name);
  }
}
