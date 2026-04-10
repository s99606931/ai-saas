/**
 * SLO 위반 자동 에스컬레이션 컨트롤러
 * Design Ref: MTU-N178 §3
 * Plan SC: FR-SLO.1~6
 */

import { z } from 'zod';

// Design Ref: 에스컬레이션 단계
export enum EscalationLevel {
  Normal = 'normal',
  Warning = 'warning',
  Danger = 'danger',
  Critical = 'critical',
  Violated = 'violated',
}

export enum NotificationChannel {
  Slack = 'slack',
  Email = 'email',
  Webhook = 'webhook',
}

// 에스컬레이션 정책 스키마 (FR-SLO.3)
const EscalationPolicySchema = z.object({
  name: z.string(),
  service: z.string(),
  levels: z.array(
    z.object({
      level: z.nativeEnum(EscalationLevel),
      budgetBurnRateMin: z.number().min(0).max(200),
      budgetBurnRateMax: z.number().min(0).max(200),
      contacts: z.array(
        z.object({
          name: z.string(),
          channel: z.nativeEnum(NotificationChannel),
          target: z.string(),
        }),
      ),
      waitMinutes: z.number().min(0),
      actions: z.array(z.string()).optional(),
    }),
  ),
});

export type EscalationPolicy = z.infer<typeof EscalationPolicySchema>;

interface EscalationEvent {
  timestamp: string;
  service: string;
  sloName: string;
  level: EscalationLevel;
  budgetBurnRate: number;
  budgetRemaining: number;
  notifiedContacts: string[];
  actionsTriggered: string[];
}

/**
 * FR-SLO.1: 에러 버짓 소진율 기반 에스컬레이션 단계 판정
 */
export function determineEscalationLevel(budgetBurnRate: number): EscalationLevel {
  if (budgetBurnRate <= 50) return EscalationLevel.Normal;
  if (budgetBurnRate <= 75) return EscalationLevel.Warning;
  if (budgetBurnRate <= 90) return EscalationLevel.Danger;
  if (budgetBurnRate <= 100) return EscalationLevel.Critical;
  return EscalationLevel.Violated;
}

/**
 * SLO 에스컬레이션 컨트롤러
 */
export class SLOEscalationController {
  private policies: Map<string, EscalationPolicy> = new Map();
  private history: EscalationEvent[] = [];
  private readonly maxHistory = 5000;

  /**
   * FR-SLO.3: 에스컬레이션 정책 등록
   */
  registerPolicy(policy: EscalationPolicy): void {
    const validated = EscalationPolicySchema.parse(policy);
    this.policies.set(validated.service, validated);
  }

  /**
   * FR-SLO.4: 에스컬레이션 실행
   */
  async escalate(
    service: string,
    sloName: string,
    budgetBurnRate: number,
    budgetRemaining: number,
  ): Promise<EscalationEvent> {
    const level = determineEscalationLevel(budgetBurnRate);
    const policy = this.policies.get(service);

    const event: EscalationEvent = {
      timestamp: new Date().toISOString(),
      service,
      sloName,
      level,
      budgetBurnRate,
      budgetRemaining,
      notifiedContacts: [],
      actionsTriggered: [],
    };

    if (!policy) {
      console.warn(`[SLO Escalation] 정책 미등록 서비스: ${service}`);
      this.recordEvent(event);
      return event;
    }

    // 해당 레벨에 맞는 정책 조회
    const levelPolicy = policy.levels.find((l) => l.level === level);
    if (!levelPolicy) {
      this.recordEvent(event);
      return event;
    }

    // FR-SLO.2: 알림 라우팅
    for (const contact of levelPolicy.contacts) {
      await this.notify(contact.channel, contact.target, {
        service,
        sloName,
        level,
        budgetBurnRate,
        budgetRemaining,
      });
      event.notifiedContacts.push(contact.name);
    }

    // FR-SLO.6: 자동 런북 트리거
    if (levelPolicy.actions) {
      for (const action of levelPolicy.actions) {
        await this.triggerAction(action, service, level);
        event.actionsTriggered.push(action);
      }
    }

    this.recordEvent(event);
    return event;
  }

  /**
   * 알림 전송 (채널별 라우팅)
   */
  private async notify(channel: NotificationChannel, target: string, data: Record<string, unknown>): Promise<void> {
    const levelLabel = this.getLevelLabel(data.level as EscalationLevel);
    const message =
      `[SLO ${levelLabel}] ${data.service} - ${data.sloName}: ` +
      `에러 버짓 ${data.budgetBurnRate}% 소진 (잔여: ${data.budgetRemaining}%)`;

    console.log(`[${channel.toUpperCase()}] → ${target}: ${message}`);
    // 실제 구현에서는 각 채널 API 호출
  }

  /**
   * 자동 행동 트리거
   */
  private async triggerAction(action: string, service: string, level: EscalationLevel): Promise<void> {
    console.log(`[ACTION] ${action} triggered for ${service} at ${level} level`);
    // 실제 구현: 런북 실행, 변경 동결, 포스트모템 생성 등
  }

  /**
   * FR-SLO.5: 에스컬레이션 이력 조회
   */
  getHistory(service?: string, limit = 100): EscalationEvent[] {
    let events = this.history;
    if (service) {
      events = events.filter((e) => e.service === service);
    }
    return events.slice(-limit);
  }

  private recordEvent(event: EscalationEvent): void {
    this.history.push(event);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }
  }

  private getLevelLabel(level: EscalationLevel): string {
    const labels: Record<EscalationLevel, string> = {
      [EscalationLevel.Normal]: '정상',
      [EscalationLevel.Warning]: '경고',
      [EscalationLevel.Danger]: '위험',
      [EscalationLevel.Critical]: '긴급',
      [EscalationLevel.Violated]: 'SLO 위반',
    };
    return labels[level];
  }
}
