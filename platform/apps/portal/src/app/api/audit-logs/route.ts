// Design Ref: §감사 로그 조회 API
// Plan SC: FR-UP.4
// CSAP: D-06 침해사고 관리 — 감사 로그 조회 (append-only, 수정 불가)
// D-08 접근 통제, D-12 입력 검증

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// DB 의존 API — 빌드 시 정적 생성 방지
export const dynamic = 'force-dynamic'

export interface AuditLogListItem {
  id: string
  action: string
  actorEmail: string | null
  tenantName: string | null
  createdAt: string
}

export interface AuditLogListResponse {
  logs: AuditLogListItem[]
  total: number
}

// Plan SC: FR-UP.4 — 최근 감사 로그 조회 (최대 20건)
export async function GET(): Promise<NextResponse<AuditLogListResponse | { error: string }>> {
  try {
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        select: {
          id: true,
          action: true,
          createdAt: true,
          actor: { select: { email: true } },
          tenant: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.auditLog.count(),
    ])

    const logList: AuditLogListItem[] = logs.map((log) => ({
      id: log.id,
      action: log.action,
      actorEmail: log.actor?.email ?? null,
      tenantName: log.tenant?.name ?? null,
      createdAt: log.createdAt.toISOString(),
    }))

    return NextResponse.json({ logs: logList, total })
  } catch (error) {
    console.error('[API] /api/audit-logs 오류:', error)
    return NextResponse.json(
      { error: '감사 로그 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
