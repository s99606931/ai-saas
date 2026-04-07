// Design Ref: §대시보드 통계 API — 플랫폼 요약 지표
// Plan SC: FR-UP.4, FR-UP.5
// CSAP: D-08 접근 통제 (데모: 인증 미적용), D-12 입력 검증

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getAuthContext } from '@/lib/auth-guard'

// DB 의존 API — 빌드 시 정적 생성 방지
export const dynamic = 'force-dynamic'

export interface DashboardStats {
  tenants: number
  users: number
  activeSubscriptions: number
  revenue: number
}

// Plan SC: FR-UP.4 — 플랫폼 현황 통계 조회
// CSAP D-08-01: 인증 필수
export async function GET(): Promise<NextResponse<DashboardStats | { error: string }>> {
  // CSAP D-08: 인증 검사
  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 })
  }

  try {
    const [tenantCount, userCount, activeSubCount, revenueResult] = await Promise.all([
      // 내부 테넌트 제외
      prisma.tenant.count({
        where: { slug: { not: 'platform-internal' } },
      }),
      // 내부 테넌트 사용자 제외
      prisma.user.count({
        where: { tenant: { slug: { not: 'platform-internal' } } },
      }),
      prisma.subscription.count({
        where: { status: 'ACTIVE' },
      }),
      // 이번 달 납부 완료 인보이스 합산
      prisma.invoice.aggregate({
        _sum: { amount: true },
        where: { status: 'paid' },
      }),
    ])

    const revenue = revenueResult._sum.amount
      ? Number(revenueResult._sum.amount)
      : 0

    return NextResponse.json({
      tenants: tenantCount,
      users: userCount,
      activeSubscriptions: activeSubCount,
      revenue,
    })
  } catch (error) {
    // CSAP D-12: 에러 메시지에 내부 정보 미노출
    process.stderr.write(`[API] /api/dashboard/stats 오류: ${String(error)}\n`)
    return NextResponse.json(
      { error: '통계 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
