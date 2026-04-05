// 구독 도메인 타입
// Design Ref: D-P00.2

/**
 * 플랜 유형
 */
export type PlanType = 'free' | 'standard' | 'enterprise';

/**
 * 구독 상태
 */
export type SubscriptionStatus = 'active' | 'past_due' | 'canceled' | 'trialing';

/**
 * 플랜 엔티티
 */
export interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  maxUsers: number;
  maxStorage: number;
  isActive: boolean;
  createdAt: Date;
}

/**
 * 구독 엔티티
 */
export interface Subscription {
  id: string;
  tenantId: string;
  planId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  canceledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
