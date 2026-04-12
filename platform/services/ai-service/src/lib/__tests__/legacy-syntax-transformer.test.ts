import { describe, it, expect, beforeEach } from 'vitest'
import { LegacySyntaxTransformer } from '../legacy-syntax-transformer'

describe('LegacySyntaxTransformer', () => {
  let tf: LegacySyntaxTransformer

  beforeEach(() => {
    tf = new LegacySyntaxTransformer()
  })

  it('C등급 차단', () => {
    expect(() => tf.transform('print "hi"', 'PYTHON2_TO_3', 'dev-1', 'C')).toThrow('BLOCKED')
  })

  it('빈 소스 차단', () => {
    expect(() => tf.transform('', 'PYTHON2_TO_3', 'dev-1', 'O')).toThrow('비어')
  })

  it('100KB 초과 차단', () => {
    const big = 'a'.repeat(100001)
    expect(() => tf.transform(big, 'PYTHON2_TO_3', 'dev-1', 'O')).toThrow('100KB')
  })

  it('시크릿 탐지 — BLOCKED', () => {
    const src = 'api_key = "sk-1234567890abcdef"\nprint(api_key)'
    expect(() => tf.transform(src, 'PYTHON2_TO_3', 'dev-1', 'O')).toThrow('시크릿')
  })

  it('Python print statement 변환', () => {
    const src = 'print "hello"\nprint "world"'
    const r = tf.transform(src, 'PYTHON2_TO_3', 'dev-1', 'O')
    expect(r.transformed).toContain('print("hello")')
    expect(r.transformed).toContain('print("world")')
    expect(r.changes).toContain('print statement → print()')
  })

  it('Python xrange/raw_input/iteritems 변환', () => {
    const src = 'for i in xrange(10):\n    name = raw_input("name")\n    for k, v in d.iteritems():\n        pass'
    const r = tf.transform(src, 'PYTHON2_TO_3', 'dev-1', 'O')
    expect(r.transformed).toContain('range(10)')
    expect(r.transformed).toContain('input(')
    expect(r.transformed).toContain('.items()')
    expect(r.changes.length).toBeGreaterThanOrEqual(3)
  })

  it('Python has_key 경고', () => {
    const src = 'if d.has_key("k"):\n    pass'
    const r = tf.transform(src, 'PYTHON2_TO_3', 'dev-1', 'O')
    expect(r.warnings.some((w) => w.includes('has_key'))).toBe(true)
  })

  it('Java 다이아몬드 변환', () => {
    const src = 'List<Integer> a = new ArrayList<Integer>();\nMap<String,Integer> b = new HashMap<String,Integer>();'
    const r = tf.transform(src, 'JAVA8_TO_17', 'dev-1', 'O')
    expect(r.transformed).toContain('new ArrayList<>()')
    expect(r.transformed).toContain('new HashMap<>()')
    expect(r.changes).toContain('제네릭 → 다이아몬드 연산자')
  })

  it('Java com.sun 경고', () => {
    const src = 'import com.sun.tools.javac.Main;\npublic class X {}'
    const r = tf.transform(src, 'JAVA8_TO_17', 'dev-1', 'O')
    expect(r.warnings.some((w) => w.includes('com.sun'))).toBe(true)
  })

  it('Java var 권고 경고', () => {
    const src = 'public class X {\n  public void m() {\n    String name = "hi";\n  }\n}'
    const r = tf.transform(src, 'JAVA8_TO_17', 'dev-1', 'O')
    expect(r.warnings.some((w) => w.includes('var'))).toBe(true)
  })

  it('통계 누적', () => {
    tf.transform('print "hi"', 'PYTHON2_TO_3', 'd', 'O')
    tf.transform('print "bye"', 'PYTHON2_TO_3', 'd', 'O')
    tf.transform('List<Integer> a = new ArrayList<Integer>();', 'JAVA8_TO_17', 'd', 'O')
    const stats = tf.getStats()
    expect(stats.PYTHON2_TO_3).toBe(2)
    expect(stats.JAVA8_TO_17).toBe(1)
  })

  it('감사 로그 — 마스킹', () => {
    tf.transform('print "hi"', 'PYTHON2_TO_3', 'developer-sensitive-id', 'O')
    const log = tf.getAuditLog()
    const entry = log.find((e) => e.action === 'transform')
    expect(entry?.callerMasked).toContain('***')
    expect(entry?.callerMasked).not.toBe('developer-sensitive-id')
  })

  it('감사 로그 — 시크릿 차단도 기록', () => {
    try {
      tf.transform('password = "abc123"', 'PYTHON2_TO_3', 'dev-1', 'O')
    } catch {
      // expected
    }
    const log = tf.getAuditLog()
    expect(log.some((e) => e.action === 'transform.blocked')).toBe(true)
  })
})
