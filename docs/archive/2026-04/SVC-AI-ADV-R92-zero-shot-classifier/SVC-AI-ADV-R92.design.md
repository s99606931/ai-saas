# SVC-AI-ADV-R92 — Zero-Shot Classifier Design

> Plan Ref: docs/01-plan/mtus/SVC-AI-ADV-R92.plan.md

## Design Anchor

- **선택**: 임베딩 코사인 유사도 기반 (LLM은 옵션)
- **대안**: 순수 LLM(비용↑), BM25(정확도↓)

## 인터페이스

```typescript
export interface CategoryLabel {
  id: string;
  name: string;
  description: string;
  keywords?: string[];
}

export interface ClassificationResult {
  documentId: string;
  topK: Array<{ categoryId: string; score: number; name: string }>;
  confidence: number;
  requiresManualReview: boolean;
  maskedText: string;
}

export interface EmbeddingClient {
  embed(text: string): Promise<number[]>;
}

export class ZeroShotClassifier {
  constructor(private deps: { embedder: EmbeddingClient; audit?: AuditSink });
  async classify(
    documentId: string,
    text: string,
    categories: CategoryLabel[],
    options?: { topK?: number }
  ): Promise<ClassificationResult>;
}
```

## 알고리즘

1. PII 마스킹 → 주민번호/전화/이메일 정규식 치환
2. 문서 임베딩 1회 + 카테고리별 임베딩 (캐시)
3. 코사인 유사도 계산 (dot product / norms)
4. 내림차순 정렬 → top-k 반환
5. top1 - top2 < 0.05 → requiresManualReview = true

## 마스킹 규칙

- 주민번호: `\d{6}-[1-4]\d{6}` → `***-******`
- 전화: `01\d-\d{3,4}-\d{4}` → `***-****-****`
- 이메일: `[\w.]+@[\w.]+` → `***@***`

## 테스트

1. 정상 분류 → top-1 정확
2. PII 마스킹 검증
3. 경계값 low confidence → manualReview=true
4. 빈 카테고리 리스트 예외
5. topK 파라미터 준수

## Session Guide

- 파일: `platform/services/ai-service/src/lib/zero-shot-classifier.ts`
- 테스트: `platform/services/ai-service/src/lib/__tests__/zero-shot-classifier.test.ts`
