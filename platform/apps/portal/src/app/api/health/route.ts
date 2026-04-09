// Design Ref: DESIGN-MTU-DEP2 Readiness Probe
// Plan SC: FR-P00.1 — 헬스체크 엔드포인트
// CSAP: D-11 시스템 가용성 모니터링

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// 빌드 시 정적 생성 방지
export const dynamic = 'force-dynamic'

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  version: string
  checks: {
    database: 'connected' | 'disconnected'
    uptime: number
  }
}

const startTime = Date.now()

// k8s readiness/liveness probe 대상
export async function GET(): Promise<NextResponse<HealthResponse>> {
  let dbStatus: 'connected' | 'disconnected' = 'disconnected'

  try {
    await prisma.$queryRaw`SELECT 1`
    dbStatus = 'connected'
  } catch {
    dbStatus = 'disconnected'
  }

  const response: HealthResponse = {
    status: dbStatus === 'connected' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    checks: {
      database: dbStatus,
      uptime: Math.floor((Date.now() - startTime) / 1000),
    },
  }

  const statusCode = dbStatus === 'connected' ? 200 : 503

  return NextResponse.json(response, { status: statusCode })
}
