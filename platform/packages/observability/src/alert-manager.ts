// 알림 임계값 관리자
// Design Ref: SVC-OBSERVE-R15 Plan
// Plan SC: FR-OBS.4
// CSAP: D-06 침해사고 관리

/**
 * 알림 상태
 */
export type AlertState = 'inactive' | 'pending' | 'firing' | 'resolved';

/**
 * 알림 규칙 정의
 */
export interface AlertRule {
  /** 규칙 이름 (고유) */
  name: string;
  /** 설명 */
  description: string;
  /** 메트릭 이름 */
  metricName: string;
  /** 임계값 */
  threshold: number;
  /** 비교 연산자 */
  operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq';
  /** 연속 위반 횟수 (flapping 방지, 기본: 1) */
  consecutiveCount?: number;
  /** 심각도 */
  severity: 'warning' | 'critical';
}

/**
 * 알림 상태 정보
 */
export interface AlertStatus {
  rule: AlertRule;
  state: AlertState;
  /** 현재 연속 위반 횟수 */
  currentCount: number;
  /** 마지막 평가 시각 */
  lastEvaluated: string;
  /** 마지막 값 */
  lastValue: number | null;
  /** firing 시작 시각 */
  firedAt: string | null;
  /** resolved 시각 */
  resolvedAt: string | null;
}

/**
 * 알림 이벤트
 */
export interface AlertEvent {
  timestamp: string;
  ruleName: string;
  previousState: AlertState;
  newState: AlertState;
  value: number;
  threshold: number;
}

/**
 * 알림 관리자
 *
 * 메트릭 임계값 기반 알림 규칙을 관리합니다.
 * 연속 위반 카운트로 flapping을 방지합니다.
 */
export class AlertManager {
  private readonly rules = new Map<string, AlertRule>();
  private readonly statuses = new Map<string, AlertStatus>();
  private readonly events: AlertEvent[] = [];
  private readonly maxEvents: number;

  constructor(maxEvents = 1000) {
    this.maxEvents = maxEvents;
  }

  /**
   * 알림 규칙 등록
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.name, rule);
    this.statuses.set(rule.name, {
      rule,
      state: 'inactive',
      currentCount: 0,
      lastEvaluated: new Date().toISOString(),
      lastValue: null,
      firedAt: null,
      resolvedAt: null,
    });
  }

  /**
   * 알림 규칙 제거
   */
  removeRule(name: string): boolean {
    this.rules.delete(name);
    return this.statuses.delete(name);
  }

  /**
   * 메트릭 값으로 알림 규칙 평가
   */
  evaluate(metricName: string, value: number): AlertEvent[] {
    const newEvents: AlertEvent[] = [];
    const now = new Date().toISOString();

    for (const [name, rule] of this.rules) {
      if (rule.metricName !== metricName) continue;

      const status = this.statuses.get(name);
      if (!status) continue;

      const violated = this.checkThreshold(value, rule.threshold, rule.operator);
      const requiredCount = rule.consecutiveCount ?? 1;
      const previousState = status.state;

      status.lastEvaluated = now;
      status.lastValue = value;

      if (violated) {
        status.currentCount++;

        if (status.currentCount >= requiredCount && status.state !== 'firing') {
          status.state = 'firing';
          status.firedAt = now;
          status.resolvedAt = null;

          const event: AlertEvent = {
            timestamp: now,
            ruleName: name,
            previousState,
            newState: 'firing',
            value,
            threshold: rule.threshold,
          };
          newEvents.push(event);
          this.addEvent(event);
        } else if (status.currentCount < requiredCount && status.state === 'inactive') {
          status.state = 'pending';
        }
      } else {
        if (status.state === 'firing') {
          status.state = 'resolved';
          status.resolvedAt = now;

          const event: AlertEvent = {
            timestamp: now,
            ruleName: name,
            previousState,
            newState: 'resolved',
            value,
            threshold: rule.threshold,
          };
          newEvents.push(event);
          this.addEvent(event);
        } else {
          status.state = 'inactive';
        }
        status.currentCount = 0;
      }
    }

    return newEvents;
  }

  /**
   * 특정 규칙의 상태 조회
   */
  getStatus(name: string): AlertStatus | null {
    return this.statuses.get(name) ?? null;
  }

  /**
   * 모든 규칙의 상태 조회
   */
  getAllStatuses(): AlertStatus[] {
    return Array.from(this.statuses.values());
  }

  /**
   * firing 상태의 알림 목록
   */
  getFiringAlerts(): AlertStatus[] {
    return this.getAllStatuses().filter((s) => s.state === 'firing');
  }

  /**
   * 알림 이벤트 이력 조회
   */
  getEvents(): readonly AlertEvent[] {
    return this.events;
  }

  /**
   * 등록된 규칙 수
   */
  getRuleCount(): number {
    return this.rules.size;
  }

  /**
   * 임계값 비교
   */
  private checkThreshold(value: number, threshold: number, operator: AlertRule['operator']): boolean {
    switch (operator) {
      case 'gt': return value > threshold;
      case 'gte': return value >= threshold;
      case 'lt': return value < threshold;
      case 'lte': return value <= threshold;
      case 'eq': return value === threshold;
    }
  }

  /**
   * 이벤트 추가 (최대 수 제한)
   */
  private addEvent(event: AlertEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }
  }
}
