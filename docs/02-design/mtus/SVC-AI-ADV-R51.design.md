# SVC-AI-ADV-R51 — Long-Context Compressor Design

> 2026-04-12 | v1.0.0

## 1. 개요
긴 문서를 의미 보존 압축합니다. LLMLingua 아이디어를 단순화하여 TF-IDF + 위치 가중치 + stopword 제거로 구현합니다.

## 2. 알고리즘
1. 입력 텍스트 → 토큰화 (공백 기반)
2. stopword (한국어/영어) 제거 후보화
3. TF-IDF 점수 + 첫/마지막 위치 보너스
4. 점수 상위 N% 유지 (목표 ratio)
5. 원본 순서 유지하여 재조립

## 3. 인터페이스
```typescript
export interface CompressInput {
  text: string;
  targetRatio?: number; // 0.3 = 30% 유지
  preserveFirstLast?: boolean;
  dataGrade?: 'O' | 'C' | 'S';
}

export interface CompressResult {
  original: string;
  compressed: string;
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  preservationRate: number;
}
```

## 4. 청크 모드
긴 문서는 N토큰 단위 청크로 분할 → 각 청크에 압축 적용 → 재결합. 청크 간 경계 정보 보존.

## 5. 변경 이력
| 1.0.0 | 2026-04-12 | 초안 |
