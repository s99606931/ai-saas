/**
 * Unit tests for AutoDoc Generator — SVC-AI-ADV-R99
 */

import { describe, it, expect } from 'vitest'
import { AutoDocGenerator } from '../autodoc-generator'

describe('SVC-AI-ADV-R99 AutoDocGenerator', () => {
  it('[FR-R99.1] parses simple function signature', () => {
    const gen = new AutoDocGenerator()
    const sigs = gen.parseSignature(
      'export function add(a: number, b: number): number { return a + b }',
    )
    expect(sigs).toHaveLength(1)
    expect(sigs[0]!.name).toBe('add')
    expect(sigs[0]!.params).toHaveLength(2)
    expect(sigs[0]!.returnType).toBe('number')
    expect(sigs[0]!.isExported).toBe(true)
  })

  it('[FR-R99.1] detects optional param', () => {
    const gen = new AutoDocGenerator()
    const sigs = gen.parseSignature(
      'function greet(name: string, title?: string): void {}',
    )
    expect(sigs[0]!.params[1]!.optional).toBe(true)
  })

  it('[FR-R99.1] detects async function', () => {
    const gen = new AutoDocGenerator()
    const sigs = gen.parseSignature(
      'export async function fetchUser(id: string): Promise<User> {}',
    )
    expect(sigs[0]!.isAsync).toBe(true)
    expect(sigs[0]!.returnType).toContain('Promise')
  })

  it('[FR-R99.2] generates JSDoc with params and returns', () => {
    const gen = new AutoDocGenerator()
    const sig = gen.parseSignature(
      'function multiply(x: number, y: number): number {}',
    )[0]!
    const doc = gen.generateJsDoc(sig, '두 숫자를 곱합니다')
    expect(doc).toContain('두 숫자를 곱합니다')
    expect(doc).toContain('@param {number} x')
    expect(doc).toContain('@param {number} y')
    expect(doc).toContain('@returns {number}')
  })

  it('[FR-R99.4] generateForFile handles multiple functions', () => {
    const source = `
      export function a(x: number): number { return x }
      export async function b(y: string): Promise<void> {}
    `
    const gen = new AutoDocGenerator()
    const blocks = gen.generateForFile(source)
    expect(blocks).toHaveLength(2)
    expect(blocks.map((b) => b.functionName)).toEqual(['a', 'b'])
  })

  it('[FR-R99.1] parses arrow function with type annotation', () => {
    const gen = new AutoDocGenerator()
    const sigs = gen.parseSignature(
      'export const sum = (a: number, b: number): number => a + b',
    )
    expect(sigs).toHaveLength(1)
    expect(sigs[0]!.name).toBe('sum')
  })

  it('[FR-R99.1] no match returns empty array', () => {
    const gen = new AutoDocGenerator()
    expect(gen.parseSignature('const x = 5')).toEqual([])
  })
})
