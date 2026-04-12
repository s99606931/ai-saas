/**
 * Unit tests for Code Complexity Analyzer — SVC-AI-ADV-R123
 */
import { describe, it, expect } from 'vitest'
import { CodeComplexityAnalyzer, DataGrade } from '../code-complexity-analyzer'

const makeModule = (overrides = {}) => ({
  path: 'src/foo.ts',
  grade: DataGrade.O,
  functions: [
    { name: 'doThing', lines: 30, cyclomaticComplexity: 5, cognitiveComplexity: 8, parameterCount: 2 },
    { name: 'helper', lines: 10, cyclomaticComplexity: 2, cognitiveComplexity: 3, parameterCount: 1 },
  ],
  afferentCoupling: 3,
  efferentCoupling: 2,
  ...overrides,
})

describe('SVC-AI-ADV-R123 CodeComplexityAnalyzer', () => {
  it('[FR-R123.1] registers module', () => {
    const analyzer = new CodeComplexityAnalyzer()
    analyzer.registerModule(makeModule())
    const report = analyzer.analyzeModule('src/foo.ts')
    expect(report.path).toBe('src/foo.ts')
  })

  it('[FR-R123.1] blocks C/S grade modules', () => {
    const analyzer = new CodeComplexityAnalyzer()
    expect(() => analyzer.registerModule(makeModule({ grade: DataGrade.C }))).toThrow('BLOCKED')
    expect(() => analyzer.registerModule(makeModule({ grade: DataGrade.S }))).toThrow('BLOCKED')
  })

  it('[FR-R123.3] instability = efferent / (afferent + efferent)', () => {
    const analyzer = new CodeComplexityAnalyzer()
    const m = makeModule({ afferentCoupling: 3, efferentCoupling: 2 })
    analyzer.registerModule(m)
    const report = analyzer.analyzeModule('src/foo.ts')
    expect(report.instability).toBeCloseTo(0.4, 2)
  })

  it('[FR-R123.4] identifies risk functions with CC > 10', () => {
    const analyzer = new CodeComplexityAnalyzer()
    analyzer.registerModule(makeModule({
      functions: [
        { name: 'risky', lines: 60, cyclomaticComplexity: 15, cognitiveComplexity: 20, parameterCount: 5 },
        { name: 'safe', lines: 10, cyclomaticComplexity: 2, cognitiveComplexity: 3, parameterCount: 1 },
      ]
    }))
    const report = analyzer.analyzeModule('src/foo.ts')
    expect(report.riskFunctions).toHaveLength(1)
    expect(report.riskFunctions[0]!.name).toBe('risky')
  })

  it('[FR-R123.5] gradeFromMI: 90 → A, 70 → B, 50 → C', () => {
    const analyzer = new CodeComplexityAnalyzer()
    expect(analyzer.gradeFromMI(90)).toBe('A')
    expect(analyzer.gradeFromMI(70)).toBe('B')
    expect(analyzer.gradeFromMI(50)).toBe('C')
    expect(analyzer.gradeFromMI(30)).toBe('D')
    expect(analyzer.gradeFromMI(10)).toBe('F')
  })

  it('[FR-R123.6] analyzeAll returns report for each module', () => {
    const analyzer = new CodeComplexityAnalyzer()
    analyzer.registerModule(makeModule({ path: 'a.ts' }))
    analyzer.registerModule(makeModule({ path: 'b.ts' }))
    const reports = analyzer.analyzeAll()
    expect(reports).toHaveLength(2)
  })

  it('throws on unknown module path', () => {
    const analyzer = new CodeComplexityAnalyzer()
    expect(() => analyzer.analyzeModule('unknown.ts')).toThrow('not registered')
  })

  it('audit log records registerModule and analyzeModule', () => {
    const analyzer = new CodeComplexityAnalyzer()
    analyzer.registerModule(makeModule())
    analyzer.analyzeModule('src/foo.ts')
    const log = analyzer.getAuditLog()
    expect(log.some(e => e.action === 'registerModule')).toBe(true)
    expect(log.some(e => e.action === 'analyzeModule')).toBe(true)
  })
})
