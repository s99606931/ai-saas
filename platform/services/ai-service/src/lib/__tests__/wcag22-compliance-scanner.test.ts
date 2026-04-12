/**
 * Unit tests for WCAG 2.2 Compliance Scanner — SVC-AI-ADV-R100
 */

import { describe, it, expect } from 'vitest'
import { Wcag22Scanner } from '../wcag22-compliance-scanner'

describe('SVC-AI-ADV-R100 Wcag22Scanner', () => {
  it('[FR-R100.2] detects target size < 24px (2.5.8)', () => {
    const html =
      '<a href="#" style="width:16px;height:16px">x</a><a href="#도움말">도움말</a>'
    const scanner = new Wcag22Scanner()
    const violations = scanner.scan(html)
    expect(violations.some((v) => v.rule === '2.5.8')).toBe(true)
  })

  it('[FR-R100.2] detects redundant entry (3.3.7)', () => {
    const html =
      '<form><input name="email"/><input name="email"/></form><a href="/help">도움말</a>'
    const violations = new Wcag22Scanner().scan(html)
    expect(violations.some((v) => v.rule === '3.3.7')).toBe(true)
  })

  it('[FR-R100.2] detects missing help link (3.2.6)', () => {
    const html = '<main>contents</main>'
    const violations = new Wcag22Scanner().scan(html)
    expect(violations.some((v) => v.rule === '3.2.6')).toBe(true)
  })

  it('[FR-R100.2] detects CAPTCHA (3.3.8)', () => {
    const html = '<form><div class="recaptcha">x</div></form><a href="/">도움말</a>'
    const violations = new Wcag22Scanner().scan(html)
    expect(violations.some((v) => v.rule === '3.3.8')).toBe(true)
  })

  it('[FR-R100.1] compliant HTML returns no violations for target/auth', () => {
    const html =
      '<button style="width:48px;height:48px">확인</button>' +
      '<a href="/help">도움말</a>' +
      '<form><input name="email"/></form>'
    const violations = new Wcag22Scanner().scan(html)
    expect(violations.filter((v) => v.rule === '2.5.8')).toHaveLength(0)
    expect(violations.filter((v) => v.rule === '3.3.7')).toHaveLength(0)
    expect(violations.filter((v) => v.rule === '3.2.6')).toHaveLength(0)
    expect(violations.filter((v) => v.rule === '3.3.8')).toHaveLength(0)
  })

  it('[FR-R100.5] report aggregates by level', () => {
    const scanner = new Wcag22Scanner()
    const violations = scanner.scan(
      '<a href="#" style="width:10px;height:10px">x</a>',
    )
    const report = scanner.report(violations)
    expect(report.total).toBeGreaterThan(0)
    expect(report.byLevel.A + report.byLevel.AA + report.byLevel.AAA).toBe(
      report.total,
    )
  })

  it('[FR-R100.3] violations carry severity level', () => {
    const scanner = new Wcag22Scanner()
    const violations = scanner.scan(
      '<a href="#" style="width:10px;height:10px">x</a><a href="/">도움말</a>',
    )
    const v258 = violations.find((v) => v.rule === '2.5.8')
    expect(v258?.level).toBe('AA')
  })

  it('[CSAP D-06] getAuditLog records scan/report actions', () => {
    const scanner = new Wcag22Scanner()
    const violations = scanner.scan('<main>x</main>')
    scanner.report(violations)
    const log = scanner.getAuditLog()
    expect(log.some((e) => e.action === 'scan')).toBe(true)
    expect(log.some((e) => e.action === 'report')).toBe(true)
  })
})
