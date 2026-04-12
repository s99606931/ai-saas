import { describe, it, expect, beforeEach } from 'vitest'
import { SecurityVulnAutoFixer, type Vulnerability } from '../security-vuln-auto-fixer'

describe('SecurityVulnAutoFixer', () => {
  let fixer: SecurityVulnAutoFixer

  const sqlVuln: Vulnerability = {
    vulnId: 'V001',
    file: 'src/db.ts',
    line: 42,
    category: 'SQL_INJECTION',
    severity: 'CRITICAL',
    description: 'SQL 주입 취약점',
    codeSnippet: 'db.query(`SELECT * FROM users WHERE id = ${id}`)',
  }

  const xssVuln: Vulnerability = {
    vulnId: 'V002',
    file: 'src/ui.ts',
    line: 10,
    category: 'XSS',
    severity: 'HIGH',
    description: 'XSS 취약점',
    codeSnippet: 'element.innerHTML = userInput',
  }

  const manualVuln: Vulnerability = {
    vulnId: 'V003',
    file: 'src/parser.ts',
    line: 5,
    category: 'INSECURE_DESERIALIZATION',
    severity: 'HIGH',
    description: '역직렬화 취약점',
    codeSnippet: 'JSON.parse(data)',
  }

  beforeEach(() => {
    fixer = new SecurityVulnAutoFixer()
    fixer.registerVuln(sqlVuln)
    fixer.registerVuln(xssVuln)
    fixer.registerVuln(manualVuln)
  })

  it('취약점 등록 감사 로그', () => {
    const log = fixer.getAuditLog()
    expect(log.some((e) => e.action === 'vuln.register')).toBe(true)
  })

  it('SQL 주입 — AUTO 자동 수정', () => {
    const result = fixer.fix('V001')
    expect(result.status).toBe('FIXED')
    expect(result.autoApplied).toBe(true)
  })

  it('XSS — AUTO 자동 수정', () => {
    const result = fixer.fix('V002')
    expect(result.status).toBe('FIXED')
    expect(result.autoApplied).toBe(true)
  })

  it('역직렬화 — MANUAL_REQUIRED', () => {
    const result = fixer.fix('V003')
    expect(result.status).toBe('MANUAL_REQUIRED')
    expect(result.autoApplied).toBe(false)
  })

  it('미등록 취약점 에러', () => {
    expect(() => fixer.fix('UNKNOWN')).toThrow()
  })

  it('전체 수정 보고서', () => {
    const report = fixer.fixAll()
    expect(report.totalVulns).toBe(3)
    expect(report.fixed).toBeGreaterThanOrEqual(2)
  })

  it('수정 후 감사 로그 기록', () => {
    fixer.fix('V001')
    const log = fixer.getAuditLog()
    expect(log.some((e) => e.action === 'vuln.fix')).toBe(true)
  })
})
