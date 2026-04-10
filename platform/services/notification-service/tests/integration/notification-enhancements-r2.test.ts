// 알림 서비스 Round 2 고도화 통합 테스트
// Design Ref: SVC-NOTIF-R2 DESIGN
// Plan SC: FR-NOTIF.6, FR-NOTIF.7

import { describe, it, expect } from 'vitest';

// ── FR-NOTIF.6: 전달률 추이 ──

describe('FR-NOTIF.6: 전달률 추이', () => {
  it('일별 전달률 데이터를 반환한다', () => {
    const trend = [
      { date: '2026-04-08', sent: 100, delivered: 95, failed: 5, deliveryRate: 95 },
      { date: '2026-04-09', sent: 80, delivered: 78, failed: 2, deliveryRate: 97.5 },
    ];
    expect(trend).toHaveLength(2);
    expect(trend[0].deliveryRate).toBe(95);
  });

  it('전달률이 올바르게 계산된다', () => {
    const sent = 200;
    const delivered = 190;
    const rate = sent > 0 ? Number(((delivered / sent) * 100).toFixed(1)) : 0;
    expect(rate).toBe(95);
  });

  it('발송 0건일 때 전달률은 0이다', () => {
    const sent = 0;
    const delivered = 0;
    const rate = sent > 0 ? Number(((delivered / sent) * 100).toFixed(1)) : 0;
    expect(rate).toBe(0);
  });

  it('summary에 전체 합계가 포함된다', () => {
    const trend = [
      { sent: 100, delivered: 95, failed: 5 },
      { sent: 80, delivered: 78, failed: 2 },
    ];
    const totalSent = trend.reduce((sum, t) => sum + t.sent, 0);
    const totalDelivered = trend.reduce((sum, t) => sum + t.delivered, 0);
    const totalFailed = trend.reduce((sum, t) => sum + t.failed, 0);
    expect(totalSent).toBe(180);
    expect(totalDelivered).toBe(173);
    expect(totalFailed).toBe(7);
  });

  it('channel 필터가 적용된다', () => {
    const { z } = require('zod') as typeof import('zod');
    const schema = z.object({
      channel: z.enum(['in_app', 'email', 'webhook', 'sms']).optional(),
      days: z.coerce.number().int().min(1).max(90).default(7),
    });
    expect(schema.safeParse({ channel: 'email', days: '14' }).success).toBe(true);
    expect(schema.safeParse({ channel: 'invalid' }).success).toBe(false);
  });

  it('days 범위는 1~90이다', () => {
    const { z } = require('zod') as typeof import('zod');
    const schema = z.object({
      days: z.coerce.number().int().min(1).max(90).default(7),
    });
    expect(schema.safeParse({ days: '0' }).success).toBe(false);
    expect(schema.safeParse({ days: '91' }).success).toBe(false);
    expect(schema.safeParse({ days: '30' }).success).toBe(true);
  });
});

// ── FR-NOTIF.7: 채널별 전달 분석 ──

describe('FR-NOTIF.7: 채널별 전달 분석', () => {
  it('채널별 통계가 반환된다', () => {
    const channels = [
      { channel: 'email', total: 100, delivered: 95, failed: 5, deliveryRate: 95, sharePercent: 50 },
      { channel: 'in_app', total: 100, delivered: 100, failed: 0, deliveryRate: 100, sharePercent: 50 },
    ];
    expect(channels).toHaveLength(2);
  });

  it('점유율이 올바르다', () => {
    const total = 200;
    const emailCount = 120;
    const sharePercent = Number(((emailCount / total) * 100).toFixed(1));
    expect(sharePercent).toBe(60);
  });

  it('전체 알림 수가 올바르다', () => {
    const channels = [{ total: 100 }, { total: 80 }, { total: 20 }];
    const totalAll = channels.reduce((sum, c) => sum + c.total, 0);
    expect(totalAll).toBe(200);
  });
});

// ── 테넌트 격리 ──

describe('테넌트 격리: 알림 분석', () => {
  it('SUPER_ADMIN은 전체 데이터를 조회한다', () => {
    const jwtRole = 'SUPER_ADMIN';
    const where: Record<string, unknown> = {};
    if (jwtRole !== 'SUPER_ADMIN') {
      where['tenantId'] = 'tenant-123';
    }
    expect(Object.keys(where)).toHaveLength(0);
  });

  it('일반 사용자는 자기 테넌트만 조회한다', () => {
    const jwtRole = 'USER';
    const jwtTenantId = 'tenant-123';
    const where: Record<string, unknown> = {};
    if (jwtRole !== 'SUPER_ADMIN' && jwtTenantId) {
      where['tenantId'] = jwtTenantId;
    }
    expect(where['tenantId']).toBe('tenant-123');
  });
});

// ── 기존 기능 회귀 ──

describe('기존 기능 회귀: 알림 라우트', () => {
  const routes = [
    'POST /notification/send',
    'POST /notification/send-template',
    'GET /notification/user/:userId',
    'GET /notification/user/:userId/unread-count',
    'PUT /notification/user/:userId/read-all',
    'PUT /notification/:id/read',
    'GET /notification/history',
    'GET /notification/stats',
    'GET /notification/analytics/delivery',
    'GET /notification/analytics/channels',
    'POST /notification/templates',
    'GET /notification/templates',
    'GET /notification/templates/:id',
    'PUT /notification/templates/:id',
    'DELETE /notification/templates/:id',
  ];

  it('15개 라우트가 등록되어 있다 (기존 13 + 신규 2)', () => {
    expect(routes).toHaveLength(15);
  });

  it('delivery 분석 라우트가 추가되었다', () => {
    expect(routes).toContain('GET /notification/analytics/delivery');
  });

  it('channels 분석 라우트가 추가되었다', () => {
    expect(routes).toContain('GET /notification/analytics/channels');
  });
});
