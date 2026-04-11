/**
 * DORA 이벤트 큐
 * Design Ref: docs/02-design/mtus/MTU-N251-dora-four-keys.design.md §3.3
 * Plan SC: FR-N251.1
 *
 * Gitea webhook 이벤트 큐잉 및 순서 보장 처리
 * 실패 시 재시도 로직 포함 (최대 3회)
 */

/** DORA 이벤트 유형 */
export enum DORAEventType {
  /** 배포 발생 */
  Deployment = 'deployment',
  /** 배포 실패 */
  DeploymentFailure = 'deployment_failure',
  /** 인시던트 시작 */
  IncidentStart = 'incident_start',
  /** 인시던트 해결 */
  IncidentResolved = 'incident_resolved',
  /** 롤백 수행 */
  Rollback = 'rollback',
  /** 핫픽스 배포 */
  Hotfix = 'hotfix',
}

/** DORA 이벤트 */
export interface DORAEvent {
  /** 이벤트 ID (중복 방지) */
  id: string;
  /** 이벤트 유형 */
  type: DORAEventType;
  /** 이벤트 발생 시각 */
  timestamp: string;
  /** 팀 이름 */
  team: string;
  /** 서비스 이름 */
  service: string;
  /** 환경 (production, staging, development) */
  environment: string;
  /** 커밋 SHA */
  commitSha?: string;
  /** 추가 메타데이터 */
  metadata?: Record<string, string | number>;
}

/** 처리 결과 */
export interface ProcessResult {
  /** 성공 처리 수 */
  processed: number;
  /** 실패 수 */
  failed: number;
  /** 큐에 남은 수 */
  remaining: number;
  /** 오류 목록 */
  errors: string[];
}

/** 큐 통계 */
export interface QueueStats {
  /** 현재 큐 길이 */
  queueLength: number;
  /** 총 처리 수 */
  totalProcessed: number;
  /** 총 실패 수 */
  totalFailed: number;
  /** 재시도 대기 수 */
  retryPending: number;
  /** 큐 가동 시간 (초) */
  uptimeSeconds: number;
}

/** 큐 아이템 (내부용) */
interface QueueItem {
  event: DORAEvent;
  retryCount: number;
  enqueuedAt: number;
  lastAttemptAt: number | null;
  lastError: string | null;
}

/** 이벤트 핸들러 타입 */
export type EventHandler = (event: DORAEvent) => Promise<void>;

export class EventQueue {
  private queue: QueueItem[] = [];
  private readonly maxQueueSize: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private handler: EventHandler | null = null;
  private totalProcessed = 0;
  private totalFailed = 0;
  private readonly startedAt: number;
  private readonly processedIds = new Set<string>();
  private readonly maxProcessedIdsSize = 10000;

  constructor(options?: {
    maxQueueSize?: number;
    maxRetries?: number;
    retryDelayMs?: number;
  }) {
    this.maxQueueSize = options?.maxQueueSize ?? 10000;
    this.maxRetries = options?.maxRetries ?? 3;
    this.retryDelayMs = options?.retryDelayMs ?? 1000;
    this.startedAt = Date.now();
  }

  /**
   * 이벤트 핸들러 등록
   */
  setHandler(handler: EventHandler): void {
    this.handler = handler;
  }

  /**
   * 이벤트 큐잉
   * Design Ref: §3.3 — 이벤트 큐잉 (실패 시 재시도)
   */
  enqueue(event: DORAEvent): boolean {
    // 중복 이벤트 방지
    if (this.processedIds.has(event.id)) {
      return false;
    }

    // 큐 용량 검사
    if (this.queue.length >= this.maxQueueSize) {
      // 큐가 가득 찬 경우 가장 오래된 항목 제거 (FIFO)
      this.queue.shift();
    }

    this.queue.push({
      event,
      retryCount: 0,
      enqueuedAt: Date.now(),
      lastAttemptAt: null,
      lastError: null,
    });

    return true;
  }

  /**
   * 배치 처리: 큐의 모든 이벤트 처리
   * Design Ref: §3.3 — 배치 처리
   */
  async flush(): Promise<ProcessResult> {
    if (!this.handler) {
      return {
        processed: 0,
        failed: 0,
        remaining: this.queue.length,
        errors: ['핸들러가 등록되지 않았습니다'],
      };
    }

    const result: ProcessResult = {
      processed: 0,
      failed: 0,
      remaining: 0,
      errors: [],
    };

    const retryQueue: QueueItem[] = [];

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;
      item.lastAttemptAt = Date.now();

      try {
        await this.handler(item.event);
        result.processed++;
        this.totalProcessed++;

        // 처리 완료 ID 기록
        this.processedIds.add(item.event.id);
        if (this.processedIds.size > this.maxProcessedIdsSize) {
          const iterator = this.processedIds.values();
          this.processedIds.delete(iterator.next().value as string);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        item.lastError = errorMsg;
        item.retryCount++;

        if (item.retryCount < this.maxRetries) {
          // 재시도 대기열에 추가
          retryQueue.push(item);
        } else {
          // 최대 재시도 초과: 실패 처리
          result.failed++;
          this.totalFailed++;
          result.errors.push(
            `이벤트 ${item.event.id} 처리 실패 (${this.maxRetries}회 재시도 후): ${errorMsg}`,
          );
        }
      }
    }

    // 재시도 대기 항목을 큐에 다시 추가
    this.queue.push(...retryQueue);
    result.remaining = this.queue.length;

    return result;
  }

  /**
   * 큐 통계 반환
   * Design Ref: §3.3 — 큐 상태
   */
  getStats(): QueueStats {
    const retryPending = this.queue.filter(item => item.retryCount > 0).length;

    return {
      queueLength: this.queue.length,
      totalProcessed: this.totalProcessed,
      totalFailed: this.totalFailed,
      retryPending,
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
    };
  }

  /**
   * 큐 초기화
   */
  clear(): void {
    this.queue = [];
  }

  /**
   * 큐 길이 반환
   */
  get length(): number {
    return this.queue.length;
  }
}
