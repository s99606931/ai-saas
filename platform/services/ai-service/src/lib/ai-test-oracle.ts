/**
 * AI Test Oracle — SVC-AI-ADV-R96
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R96.design.md
 * Plan SC: FR-R96.1 ~ FR-R96.5
 *
 * 예상 출력 없이 출력의 정합성을 판단한다.
 * 계약(contract) 기반 판정으로 공공 SaaS 테스트 자동화.
 */

export type Judgement = 'PASS' | 'FAIL' | 'UNCERTAIN'

export type SchemaShape = 'string' | 'number' | 'boolean' | 'array' | 'object'

export interface SchemaContract {
  type: 'schema'
  shape: Record<string, SchemaShape>
  requiredKeys?: string[]
}

export interface InvariantCheck {
  name: string
  predicate: (input: unknown, output: unknown) => boolean
}

export interface InvariantContract {
  type: 'invariant'
  checks: InvariantCheck[]
}

export interface SemanticContract {
  type: 'semantic'
  instruction: string
}

export type Contract = SchemaContract | InvariantContract | SemanticContract

export interface OracleResult {
  judgement: Judgement
  violations: string[]
  confidence: number
  evaluatedAt: string
}

export interface LlmClient {
  complete(prompt: string): Promise<string>
}

export interface OracleOptions {
  llm?: LlmClient
}

export class AiTestOracle {
  private readonly llm?: LlmClient

  constructor(opts: OracleOptions = {}) {
    this.llm = opts.llm
  }

  /**
   * FR-R96.1: 입력/출력/계약으로 판정.
   */
  async evaluate(
    input: unknown,
    output: unknown,
    contract: Contract,
  ): Promise<OracleResult> {
    const evaluatedAt = new Date().toISOString()
    switch (contract.type) {
      case 'schema':
        return { ...this.evaluateSchema(output, contract), evaluatedAt }
      case 'invariant':
        return {
          ...this.evaluateInvariant(input, output, contract),
          evaluatedAt,
        }
      case 'semantic':
        return {
          ...(await this.evaluateSemantic(input, output, contract)),
          evaluatedAt,
        }
    }
  }

  private evaluateSchema(
    output: unknown,
    contract: SchemaContract,
  ): Omit<OracleResult, 'evaluatedAt'> {
    const violations: string[] = []
    if (typeof output !== 'object' || output === null) {
      return {
        judgement: 'FAIL',
        violations: ['output is not an object'],
        confidence: 1.0,
      }
    }
    const obj = output as Record<string, unknown>

    // FR-R96.3: required keys
    for (const k of contract.requiredKeys ?? []) {
      if (!(k in obj)) violations.push(`missing required key: ${k}`)
    }

    // type check
    for (const [key, expectedType] of Object.entries(contract.shape)) {
      if (!(key in obj)) continue
      const actual = obj[key]
      if (!this.typeMatches(actual, expectedType)) {
        violations.push(
          `key '${key}': expected ${expectedType}, got ${typeof actual}`,
        )
      }
    }

    return {
      judgement: violations.length === 0 ? 'PASS' : 'FAIL',
      violations,
      confidence: 1.0,
    }
  }

  private evaluateInvariant(
    input: unknown,
    output: unknown,
    contract: InvariantContract,
  ): Omit<OracleResult, 'evaluatedAt'> {
    const violations: string[] = []
    for (const check of contract.checks) {
      try {
        if (!check.predicate(input, output)) {
          violations.push(`invariant failed: ${check.name}`)
        }
      } catch (err) {
        violations.push(
          `invariant error '${check.name}': ${(err as Error).message}`,
        )
      }
    }
    return {
      judgement: violations.length === 0 ? 'PASS' : 'FAIL',
      violations,
      confidence: 1.0,
    }
  }

  private async evaluateSemantic(
    input: unknown,
    output: unknown,
    contract: SemanticContract,
  ): Promise<Omit<OracleResult, 'evaluatedAt'>> {
    if (!this.llm) {
      return {
        judgement: 'UNCERTAIN',
        violations: ['llm not configured for semantic contract'],
        confidence: 0,
      }
    }
    const prompt = [
      '당신은 테스트 오라클입니다.',
      `계약: ${contract.instruction}`,
      `입력: ${JSON.stringify(input).slice(0, 500)}`,
      `출력: ${JSON.stringify(output).slice(0, 500)}`,
      '다음 JSON만 반환하세요: {"verdict":"PASS|FAIL","reason":"..."}',
    ].join('\n')
    try {
      const raw = await this.llm.complete(prompt)
      const parsed = JSON.parse(raw) as { verdict?: string; reason?: string }
      if (parsed.verdict === 'PASS') {
        return { judgement: 'PASS', violations: [], confidence: 0.8 }
      }
      if (parsed.verdict === 'FAIL') {
        return {
          judgement: 'FAIL',
          violations: [parsed.reason ?? 'semantic violation'],
          confidence: 0.8,
        }
      }
      return {
        judgement: 'UNCERTAIN',
        violations: ['unrecognized verdict'],
        confidence: 0.3,
      }
    } catch (err) {
      return {
        judgement: 'UNCERTAIN',
        violations: [`llm error: ${(err as Error).message}`],
        confidence: 0,
      }
    }
  }

  private typeMatches(value: unknown, expected: SchemaShape): boolean {
    switch (expected) {
      case 'string':
        return typeof value === 'string'
      case 'number':
        return typeof value === 'number'
      case 'boolean':
        return typeof value === 'boolean'
      case 'array':
        return Array.isArray(value)
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value)
    }
  }
}
