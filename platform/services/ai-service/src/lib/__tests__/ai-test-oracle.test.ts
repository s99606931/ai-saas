/**
 * Unit tests for AI Test Oracle — SVC-AI-ADV-R96
 */

import { describe, it, expect, vi } from 'vitest'
import {
  AiTestOracle,
  type LlmClient,
  type SchemaContract,
  type InvariantContract,
  type SemanticContract,
} from '../ai-test-oracle'

describe('SVC-AI-ADV-R96 AiTestOracle', () => {
  it('[FR-R96.3] schema contract PASS', async () => {
    const oracle = new AiTestOracle()
    const contract: SchemaContract = {
      type: 'schema',
      shape: { id: 'string', count: 'number' },
      requiredKeys: ['id'],
    }
    const result = await oracle.evaluate(null, { id: 'a', count: 3 }, contract)
    expect(result.judgement).toBe('PASS')
    expect(result.violations).toHaveLength(0)
  })

  it('[FR-R96.3] schema contract FAIL on missing required key', async () => {
    const oracle = new AiTestOracle()
    const contract: SchemaContract = {
      type: 'schema',
      shape: { id: 'string' },
      requiredKeys: ['id'],
    }
    const result = await oracle.evaluate(null, { name: 'x' }, contract)
    expect(result.judgement).toBe('FAIL')
    expect(result.violations.some((v) => v.includes('missing'))).toBe(true)
  })

  it('[FR-R96.4] invariant contract PASS', async () => {
    const oracle = new AiTestOracle()
    const contract: InvariantContract = {
      type: 'invariant',
      checks: [
        {
          name: 'output-gte-input',
          predicate: (input, output) =>
            (output as number) >= (input as number),
        },
      ],
    }
    const result = await oracle.evaluate(5, 10, contract)
    expect(result.judgement).toBe('PASS')
  })

  it('[FR-R96.4] invariant FAIL', async () => {
    const oracle = new AiTestOracle()
    const contract: InvariantContract = {
      type: 'invariant',
      checks: [
        {
          name: 'positive',
          predicate: (_i, o) => (o as number) > 0,
        },
      ],
    }
    const result = await oracle.evaluate(0, -5, contract)
    expect(result.judgement).toBe('FAIL')
  })

  it('[FR-R96.5] semantic PASS with LLM', async () => {
    const llm: LlmClient = {
      complete: vi.fn().mockResolvedValue('{"verdict":"PASS","reason":"ok"}'),
    }
    const oracle = new AiTestOracle({ llm })
    const contract: SemanticContract = {
      type: 'semantic',
      instruction: '출력이 입력을 요약하는가?',
    }
    const result = await oracle.evaluate('긴 글', '짧은 요약', contract)
    expect(result.judgement).toBe('PASS')
  })

  it('[FR-R96.5] semantic UNCERTAIN without LLM', async () => {
    const oracle = new AiTestOracle()
    const contract: SemanticContract = {
      type: 'semantic',
      instruction: 'x',
    }
    const result = await oracle.evaluate('i', 'o', contract)
    expect(result.judgement).toBe('UNCERTAIN')
    expect(result.confidence).toBe(0)
  })

  it('[FR-R96.3] schema FAIL on non-object output', async () => {
    const oracle = new AiTestOracle()
    const contract: SchemaContract = {
      type: 'schema',
      shape: { k: 'string' },
    }
    const result = await oracle.evaluate(null, 'string-not-object', contract)
    expect(result.judgement).toBe('FAIL')
  })
})
