// 테넌트별 AI 사용량 제한
// Design Ref: SVC-AI-R1 DESIGN §3
// Plan SC: FR-AI.3
// CSAP: D-10 — 리소스 사용량 제한

import { prisma } from './prisma.js';

/** 일일 토큰 한도 (환경 변수, 기본 100,000) */
const DAILY_TOKEN_LIMIT = parseInt(process.env['AI_DAILY_TOKEN_LIMIT'] ?? '100000', 10);

/**
 * 사용량 제한 검사 결과
 */
export interface UsageLimitResult {
  /** 허용 여부 */
  allowed: boolean;
  /** 오늘 사용한 토큰 수 */
  usedToday: number;
  /** 일일 한도 */
  dailyLimit: number;
  /** 남은 토큰 수 */
  remaining: number;
}

/**
 * 테넌트별 일일 AI 사용량 검사
 *
 * 오늘 날짜의 토큰 사용량을 집계하여 한도와 비교합니다.
 *
 * @param tenantId - 테넌트 ID
 * @returns 사용량 제한 검사 결과
 */
export async function checkUsageLimit(tenantId: string): Promise<UsageLimitResult> {
  // 오늘 시작 시각 (UTC)
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const todayUsage = await prisma.aiUsage.aggregate({
    where: {
      tenantId,
      createdAt: { gte: todayStart },
    },
    _sum: { tokens: true },
  });

  const usedToday = todayUsage._sum.tokens ?? 0;
  const remaining = Math.max(0, DAILY_TOKEN_LIMIT - usedToday);

  return {
    allowed: usedToday < DAILY_TOKEN_LIMIT,
    usedToday,
    dailyLimit: DAILY_TOKEN_LIMIT,
    remaining,
  };
}
