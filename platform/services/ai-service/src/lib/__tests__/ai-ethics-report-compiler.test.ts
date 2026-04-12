/**
 * Unit tests for AI Ethics Report Compiler — SVC-AI-ADV-R104
 */

import { describe, it, expect } from 'vitest'
import {
  AiEthicsReportCompiler,
  type EthicsAuditData,
} from '../ai-ethics-report-compiler'

const baseData: EthicsAuditData = {
  organization: '서울시 정보통신본부',
  systemName: 'AI 민원 챗봇',
  auditDate: '2026-04-12',
  auditor: '감사팀',
  results: [
    { principle: 'TRANSPARENCY', passed: true, findings: [], score: 90 },
    { principle: 'FAIRNESS', passed: false, findings: ['성별 편향'], score: 60 },
    { principle: 'PRIVACY', passed: true, findings: [], score: 95 },
  ],
  recommendations: ['편향 데이터 재학습', 'PIA 분기별 시행'],
}

describe('SVC-AI-ADV-R104 AiEthicsReportCompiler', () => {
  it('[FR-R104.1] compiles Markdown report', () => {
    const c = new AiEthicsReportCompiler()
    const md = c.compile(baseData)
    expect(md).toContain('# AI 윤리 감사 보고서')
  })

  it('[FR-R104.5] includes metadata', () => {
    const c = new AiEthicsReportCompiler()
    const md = c.compile(baseData)
    expect(md).toContain('서울시 정보통신본부')
    expect(md).toContain('AI 민원 챗봇')
    expect(md).toContain('2026-04-12')
  })

  it('[FR-R104.2] includes principle evaluation table', () => {
    const c = new AiEthicsReportCompiler()
    const md = c.compile(baseData)
    expect(md).toContain('투명성')
    expect(md).toContain('공정성')
    expect(md).toContain('성별 편향')
  })

  it('[FR-R104.4] renders recommendations', () => {
    const c = new AiEthicsReportCompiler()
    const md = c.compile(baseData)
    expect(md).toContain('편향 데이터 재학습')
    expect(md).toContain('PIA 분기별 시행')
  })

  it('[FR-R104.1] empty recommendations', () => {
    const c = new AiEthicsReportCompiler()
    const md = c.compile({ ...baseData, recommendations: [] })
    expect(md).toContain('권고사항 없음')
  })

  it('[FR-R104.3] summary counts passed principles', () => {
    const c = new AiEthicsReportCompiler()
    const md = c.compile(baseData)
    // 2 passed of 3
    expect(md).toContain('2개 통과')
  })

  it('[FR-R104.3] average score calculation', () => {
    const c = new AiEthicsReportCompiler()
    const md = c.compile(baseData)
    // (90 + 60 + 95) / 3 = 81.7
    expect(md).toContain('81.7')
  })
})
