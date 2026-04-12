// Task Queue -- 동시성 제한 + 우선순위 큐
// Design Ref: SVC-QUEUE-R36 DESIGN
// Plan SC: FR-TQ.1~FR-TQ.6
// CSAP: D-14 가용성 (리소스 폭주 방지)

export interface TaskQueueOptions {
  /** 동시 실행 최대 개수 */
  concurrency: number;
}

export interface AddOptions {
  /** 높을수록 먼저 실행 (기본 0) */
  priority?: number;
}

interface QueuedTask<T> {
  run: () => Promise<T>;
  priority: number;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

/**
 * 동시성 제한 태스크 큐
 *
 * Plan SC: FR-TQ.1~FR-TQ.6
 */
export class TaskQueue {
  private queue: QueuedTask<unknown>[] = [];
  private pendingCount = 0;
  private concurrencyLimit: number;
  private idleResolvers: Array<() => void> = [];

  constructor(options: TaskQueueOptions) {
    if (options.concurrency < 1 || !Number.isInteger(options.concurrency)) {
      throw new Error('concurrency는 1 이상의 정수여야 합니다.');
    }
    this.concurrencyLimit = options.concurrency;
  }

  /**
   * 작업 추가. 반환 Promise는 작업 완료 시 결과로 resolve.
   * Plan SC: FR-TQ.2, FR-TQ.3
   */
  add<T>(fn: () => Promise<T>, options: AddOptions = {}): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task: QueuedTask<T> = {
        run: fn,
        priority: options.priority ?? 0,
        resolve,
        reject,
      };
      this.insertByPriority(task as QueuedTask<unknown>);
      this.next();
    });
  }

  /**
   * 우선순위 정렬 삽입 (높은 우선순위 먼저)
   * Plan SC: FR-TQ.3
   */
  private insertByPriority(task: QueuedTask<unknown>): void {
    let i = 0;
    while (i < this.queue.length && this.queue[i]!.priority >= task.priority) {
      i++;
    }
    this.queue.splice(i, 0, task);
  }

  /**
   * 다음 작업 실행 시도
   * Plan SC: FR-TQ.1
   */
  private next(): void {
    while (this.pendingCount < this.concurrencyLimit && this.queue.length > 0) {
      const task = this.queue.shift()!;
      this.pendingCount++;
      void this.runTask(task);
    }
  }

  private async runTask(task: QueuedTask<unknown>): Promise<void> {
    try {
      const result = await task.run();
      task.resolve(result);
    } catch (error) {
      task.reject(error);
    } finally {
      this.pendingCount--;
      if (this.pendingCount === 0 && this.queue.length === 0) {
        const resolvers = [...this.idleResolvers];
        this.idleResolvers.length = 0;
        for (const r of resolvers) r();
      }
      this.next();
    }
  }

  /**
   * 대기 중인 작업 취소 (실행 중 작업은 계속 진행)
   * Plan SC: FR-TQ.4
   */
  clear(): number {
    const cleared = this.queue.length;
    for (const task of this.queue) {
      task.reject(new Error('큐가 초기화되어 작업이 취소되었습니다.'));
    }
    this.queue = [];
    return cleared;
  }

  /**
   * 큐 대기 작업 수
   * Plan SC: FR-TQ.5
   */
  get size(): number {
    return this.queue.length;
  }

  /**
   * 실행 중인 작업 수
   * Plan SC: FR-TQ.5
   */
  get pending(): number {
    return this.pendingCount;
  }

  /**
   * 동시성 한도 조정
   */
  setConcurrency(limit: number): void {
    if (limit < 1 || !Number.isInteger(limit)) {
      throw new Error('concurrency는 1 이상의 정수여야 합니다.');
    }
    this.concurrencyLimit = limit;
    this.next();
  }

  get concurrency(): number {
    return this.concurrencyLimit;
  }

  /**
   * 모든 작업이 완료될 때까지 대기
   * Plan SC: FR-TQ.6
   */
  idle(): Promise<void> {
    if (this.pendingCount === 0 && this.queue.length === 0) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }
}
