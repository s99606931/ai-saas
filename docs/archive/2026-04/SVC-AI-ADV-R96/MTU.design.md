# SVC-AI-ADV-R96 — AI Test Oracle Design

## 인터페이스

```typescript
export type Judgement = 'PASS' | 'FAIL' | 'UNCERTAIN';

export interface SchemaContract {
  type: 'schema';
  shape: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object'>;
  requiredKeys?: string[];
}

export interface InvariantContract {
  type: 'invariant';
  checks: Array<{ name: string; predicate: (input: unknown, output: unknown) => boolean }>;
}

export interface SemanticContract {
  type: 'semantic';
  instruction: string;
}

export type Contract = SchemaContract | InvariantContract | SemanticContract;

export interface OracleResult {
  judgement: Judgement;
  violations: string[];
  confidence: number;
}

export class AiTestOracle {
  constructor(deps: { llm?: { complete(prompt: string): Promise<string> } });
  async evaluate(input: unknown, output: unknown, contract: Contract): Promise<OracleResult>;
}
```

## 로직

1. schema: 키/타입/required 검사
2. invariant: 모든 predicate true여야 PASS
3. semantic: LLM 프롬프트로 판정 → JSON {verdict, reason}
4. LLM 부재 시 semantic → UNCERTAIN

## 테스트

1. schema PASS / FAIL
2. invariant PASS / FAIL  
3. semantic PASS (mock LLM)
4. LLM 없이 semantic → UNCERTAIN
5. required key 누락 → FAIL
