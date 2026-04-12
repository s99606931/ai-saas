# SVC-AI-ADV-R102 — PII-Safe Test Data Factory Design

## 인터페이스

```typescript
export type PiiType = 'KR_RRN' | 'KR_PHONE' | 'EMAIL' | 'NAME' | 'ADDRESS' | 'NONE';

export interface FieldSpec {
  name: string;
  piiType: PiiType;
  distribution?: 'normal' | 'uniform' | 'categorical';
  params?: Record<string, unknown>;
}

export interface FactoryOptions {
  seed?: number;
}

export class PiiSafeDataFactory {
  constructor(opts?: FactoryOptions);
  generate(spec: FieldSpec[], count: number): Record<string, unknown>[];
  verifyNoPii(records: Record<string, unknown>[], spec: FieldSpec[]): boolean;
}
```

## 대체값 규칙

- KR_RRN → 항상 '000000-0000000' (가상) + 논리값 '*'
- KR_PHONE → '010-0000-XXXX' (XXXX=난수 0000)
- EMAIL → 'user{N}@example.test'
- NAME → ['홍길동', '이몽룡', '성춘향', '김철수'] 중 순환
- ADDRESS → '서울특별시 종로구 세종로 {N}' (N=1~10)

## 시드 PRNG (mulberry32)

재현성을 위해 간단한 PRNG 사용.

## 테스트

1. generate N건 정확
2. PII 대체값 검증
3. verifyNoPii 정상 판정
4. 시드 재현성 (동일 시드 → 동일 결과)
5. 카테고리 분포
