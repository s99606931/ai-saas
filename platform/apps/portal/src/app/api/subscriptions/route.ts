// Design Ref: §구독 목록 API
// Plan SC: FR-UP.4
// CSAP: D-08 접근 통제, D-12 입력 검증

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthContext, isAdmin } from '@/lib/auth-guard'

// DB 의존 API — 빌드 시 정적 생성 방지
export const dynamic = 'force-dynamic'

export interface SubscriptionListItem {
  id: string
  tenantName: string
  planName: string
  status: string
  currentPeriodEnd: string
}

export interface SubscriptionListResponse {
  subscriptions: SubscriptionListItem[]
  total: number
}

// Plan SC: FR-UP.4 — 구독 목록 페이지네이션 조회
// CSAP D-08-01: 인증 필수, D-08-05: 관리자 전용
export async function GET(
  request: NextRequest
): Promise<NextResponse<SubscriptionListResponse | { error: string }>> {
  // CSAP D-08: 인증 + RBAC 검사
  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }
  if (!isAdmin(auth)) {
    return NextResponse.json({ error: '구독 목록 조회 권한이 없습니다' }, { status: 403 })
  }

  try {
    const { searchParams } = request.nextUrl

    // CSAP D-12: 입력 검증
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)))
    const skip = (page - 1) * limit

    const [subscriptions, total] = await Promise.all([
      prisma.subscription.findMany({
        select: {
          id: true,
          status: true,
          currentPeriodEnd: true,
          tenant: { select: { name: true } },
          plan: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.subscription.count(),
    ])

    const subscriptionList: SubscriptionListItem[] = subscriptions.map((sub) => ({
      id: sub.id,
      tenantName: sub.tenant.name,
      planName: sub.plan.name,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
    }))

    return NextResponse.json({ subscriptions: subscriptionList, total })
  } catch (error) {
    process.stderr.write(`[API] /api/subscriptions 오류: ${String(error)}\n`)
    return NextResponse.json(
      { error: '구독 목록 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
