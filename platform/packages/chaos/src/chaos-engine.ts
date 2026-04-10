// Chaos Engineering 엔진
// Design Ref: SVC-CHAOS-R12 Plan
// Plan SC: FR-CHAOS.1, FR-CHAOS.4
// CSAP: D-07 가용성 -- 장애 복원력 검증

/**
 * 장애 유형 정의
 */
export type FaultType = 'latency' | 'error' | 'connection_failure';

/**
 * 장애 주입 설정
 */
export interface FaultConfig {
  /** 장애 유형 */
  type: FaultType;
  /** 대상 서비스/경로 패턴 (정규식) */
  targetPattern?: string;
  /** 발생 확률 (0.0~1.0) */
  probability: number;
  /** 지연 시간 (ms) -- latency 유형 전용 */
  delayMs?: number;
  /** HTTP 에러 코드 -- error 유형 전용 */
  errorCode?: number;
  /** 에러 메시지 -- error 유형 전용 */
  errorMessage?: string;
  /** 최대 지속 시간 (ms) -- 자동 해제용 */
  durationMs?: number;
}

/**
 * 장애 주입 이벤트 로그
 */
export interface FaultEvent {
  id: string;
  faultId: string;
  type: FaultType;
  target: string;
  timestamp: string;
  applied: boolean;
}

/**
 * Chaos Engine -- 장애 주입 관리자
 *
 * CSAP D-07 가용성 검증:
 * - 서비스 장애 시 격리 동작 확인
 * - Circuit Breaker 작동 검증
 * - Graceful degradation 확인
 *
 * FR-CHAOS.4: 프로덕션 환경 안전 가드
 * - NODE_ENV !== 'test' && NODE_ENV !== 'development' 시 전체 비활성화
 */
export class ChaosEngine {
  private readonly faults = new Map<string, FaultConfig & { id: string; createdAt: number }>();
  private readonly events: FaultEvent[] = [];
  private readonly maxEvents = 1000;
  private enabled = false;
  private idCounter = 0;

  constructor() {
    // FR-CHAOS.4: 프로덕션 안전 가드
    const env = process.env['NODE_ENV'] ?? 'production';
    if (env === 'test' || env === 'development') {
      this.enabled = true;
    }
  }

  /**
   * Chaos 기능 활성화 여부
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * 수동 활성화 (테스트 전용)
   */
  enable(): void {
    const env = process.env['NODE_ENV'] ?? 'production';
    if (env === 'production') {
      throw new Error('BLOCKED: 프로덕션 환경에서 Chaos 기능 활성화 금지 (CSAP D-07)');
    }
    this.enabled = true;
  }

  /**
   * 비활성화 (모든 장애 해제)
   */
  disable(): void {
    this.enabled = false;
    this.faults.clear();
  }

  /**
   * 장애 주입 등록
   */
  injectFault(config: FaultConfig): string {
    if (!this.enabled) {
      return '';
    }

    const id = `fault-${++this.idCounter}`;
    this.faults.set(id, { ...config, id, createdAt: Date.now() });

    // durationMs 설정 시 자동 해제 타이머
    if (config.durationMs && config.durationMs > 0) {
      setTimeout(() => {
        this.removeFault(id);
      }, config.durationMs);
    }

    return id;
  }

  /**
   * 장애 해제
   */
  removeFault(id: string): boolean {
    return this.faults.delete(id);
  }

  /**
   * 전체 장애 해제
   */
  clearAllFaults(): void {
    this.faults.clear();
  }

  /**
   * 등록된 장애 목록
   */
  listFaults(): Array<FaultConfig & { id: string }> {
    return Array.from(this.faults.values());
  }

  /**
   * 요청에 대해 장애 적용 여부 판단 및 실행
   *
   * @param target - 대상 (서비스명 또는 URL 경로)
   * @returns 적용된 장애 정보 또는 null (정상 처리)
   */
  async applyFault(target: string): Promise<{
    type: FaultType;
    delayMs?: number;
    errorCode?: number;
    errorMessage?: string;
  } | null> {
    if (!this.enabled || this.faults.size === 0) {
      return null;
    }

    // 만료된 장애 정리
    this.cleanupExpired();

    for (const fault of this.faults.values()) {
      // 대상 패턴 매칭
      if (fault.targetPattern) {
        const regex = new RegExp(fault.targetPattern);
        if (!regex.test(target)) continue;
      }

      // 확률 기반 적용
      if (Math.random() > fault.probability) {
        this.recordEvent(fault.id, fault.type, target, false);
        continue;
      }

      this.recordEvent(fault.id, fault.type, target, true);

      switch (fault.type) {
        case 'latency':
          if (fault.delayMs && fault.delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, fault.delayMs));
          }
          return { type: 'latency', delayMs: fault.delayMs };

        case 'error':
          return {
            type: 'error',
            errorCode: fault.errorCode ?? 500,
            errorMessage: fault.errorMessage ?? 'Chaos: 주입된 에러',
          };

        case 'connection_failure':
          return {
            type: 'connection_failure',
            errorCode: 503,
            errorMessage: 'Chaos: 연결 실패 시뮬레이션',
          };
      }
    }

    return null;
  }

  /**
   * 장애 이벤트 로그 조회
   */
  getEvents(): FaultEvent[] {
    return [...this.events];
  }

  /**
   * 이벤트 로그 초기화
   */
  clearEvents(): void {
    this.events.length = 0;
  }

  /**
   * 통계
   */
  getStats(): {
    totalFaults: number;
    totalEvents: number;
    appliedEvents: number;
    skippedEvents: number;
  } {
    const applied = this.events.filter((e) => e.applied).length;
    return {
      totalFaults: this.faults.size,
      totalEvents: this.events.length,
      appliedEvents: applied,
      skippedEvents: this.events.length - applied,
    };
  }

  /**
   * 만료된 장애 정리
   */
  private cleanupExpired(): void {
    const now = Date.now();
    for (const [id, fault] of this.faults.entries()) {
      if (fault.durationMs && (now - fault.createdAt) >= fault.durationMs) {
        this.faults.delete(id);
      }
    }
  }

  /**
   * 이벤트 기록
   */
  private recordEvent(faultId: string, type: FaultType, target: string, applied: boolean): void {
    this.events.push({
      id: `evt-${this.events.length + 1}`,
      faultId,
      type,
      target,
      timestamp: new Date().toISOString(),
      applied,
    });

    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }
  }
}
