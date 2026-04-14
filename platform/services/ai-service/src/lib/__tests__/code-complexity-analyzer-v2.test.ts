import { describe, it, expect, beforeEach } from 'vitest'
import { CodeComplexityAnalyzerV2 } from '../code-complexity-analyzer-v2'

describe('CodeComplexityAnalyzerV2', () => {
  let analyzer: CodeComplexityAnalyzerV2
  beforeEach(() => { analyzer = new CodeComplexityAnalyzerV2() })

  it('모듈 등록 후 조회 가능', () => {
    const mod = analyzer.registerModule('mod-1', 'auth.ts', 'typescript')
    expect(mod.moduleId).toBe('mod-1')
    expect(mod.language).toBe('typescript')
  })

  it('high 등급: cyclomaticComplexity >= 20', () => {
    analyzer.registerModule('mod-1', 'auth.ts', 'typescript')
    analyzer.recordMetrics('mod-1', 25, 300)
    expect(analyzer.getComplexityGrade('mod-1')).toBe('high')
  })

  it('medium 등급: >= 10 < 20', () => {
    analyzer.registerModule('mod-1', 'auth.ts', 'typescript')
    analyzer.recordMetrics('mod-1', 15, 200)
    expect(analyzer.getComplexityGrade('mod-1')).toBe('medium')
  })

  it('low 등급: < 10', () => {
    analyzer.registerModule('mod-1', 'auth.ts', 'typescript')
    analyzer.recordMetrics('mod-1', 5, 50)
    expect(analyzer.getComplexityGrade('mod-1')).toBe('low')
  })

  it('getHighComplexityModules: high 등급만', () => {
    analyzer.registerModule('mod-1', 'auth.ts', 'typescript')
    analyzer.registerModule('mod-2', 'simple.ts', 'typescript')
    analyzer.recordMetrics('mod-1', 25, 300)
    analyzer.recordMetrics('mod-2', 3, 20)
    const high = analyzer.getHighComplexityModules()
    expect(high.map(m => m.moduleId)).toContain('mod-1')
    expect(high.map(m => m.moduleId)).not.toContain('mod-2')
  })

  it('C등급 데이터 전송 차단', () => {
    analyzer.registerModule('mod-1', 'auth.ts', 'typescript')
    expect(() => analyzer.recordMetrics('mod-1', 25, 300, 'C')).toThrow('BLOCKED')
  })

  it('S등급 데이터 전송 차단', () => {
    analyzer.registerModule('mod-1', 'auth.ts', 'typescript')
    expect(() => analyzer.recordMetrics('mod-1', 25, 300, 'S')).toThrow('BLOCKED')
  })

  it('감사 로그 기록', () => {
    analyzer.registerModule('mod-1', 'auth.ts', 'typescript')
    analyzer.recordMetrics('mod-1', 15, 200)
    expect(analyzer.getAuditLog().length).toBeGreaterThanOrEqual(2)
  })
})
