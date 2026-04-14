// Design Ref: §우선순위점수 — severity기본점수+min(recipients/100,1)×20-(isDuplicate?30:0)
// Plan SC: SC-R601-1, SC-R601-2, SC-R601-3

interface NotificationInput {
  notificationId: string;
  category: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  recipientCount: number;
  isDuplicate: boolean;
}

type DeliveryChannel = 'SMS+EMAIL' | 'EMAIL' | 'APP' | 'SUPPRESS';

interface NotificationResult {
  notificationId: string;
  priorityScore: number;
  deliveryChannel: DeliveryChannel;
  isSuppressed: boolean;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  notificationId: string;
  deliveryChannel: DeliveryChannel;
  priorityScore: number;
}

const SEVERITY_BASE: Record<string, number> = {
  CRITICAL: 100,
  HIGH: 70,
  MEDIUM: 40,
  LOW: 10,
};

export class IntelligentNotificationManagerV2 {
  private readonly auditLog: AuditEntry[] = [];

  process(input: NotificationInput): NotificationResult {
    const { notificationId, severity, recipientCount, isDuplicate } = input;

    const priorityScore =
      (SEVERITY_BASE[severity] ?? 10) +
      Math.min(recipientCount / 100, 1) * 20 -
      (isDuplicate ? 30 : 0);

    const deliveryChannel = this.determineChannel(priorityScore);
    const isSuppressed = deliveryChannel === 'SUPPRESS';

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'NOTIFICATION_PROCESSED',
      notificationId,
      deliveryChannel,
      priorityScore: Math.round(priorityScore * 100) / 100,
    });

    return {
      notificationId,
      priorityScore: Math.round(priorityScore * 100) / 100,
      deliveryChannel,
      isSuppressed,
    };
  }

  private determineChannel(score: number): DeliveryChannel {
    if (score >= 80) return 'SMS+EMAIL';
    if (score >= 50) return 'EMAIL';
    if (score >= 20) return 'APP';
    return 'SUPPRESS';
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
