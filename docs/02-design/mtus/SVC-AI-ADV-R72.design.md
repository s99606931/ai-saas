# SVC-AI-ADV-R72 — 설계

## 모듈
- `cot-verifier.ts`
  - `CoTVerifier` 클래스

## 핵심 타입
```typescript
type DataGrade = 'C' | 'S' | 'O';

interface CoTStep {
  index: number;
  text: string;
  claims: string[];        // 추출된 주장
  refs: number[];          // 참조 단계 번호
  numbers: number[];       // 단계에 포함된 수치
}

interface CoTDocument {
  id: string;
  steps: CoTStep[];
  conclusion: string;
  grade: DataGrade;
}

type IssueKind =
  | 'missing-ref'
  | 'circular-ref'
  | 'numeric-inconsistency'
  | 'contradiction'
  | 'orphan-step'
  | 'unsupported-conclusion';

interface VerificationIssue {
  stepIndex: number;
  kind: IssueKind;
  message: string;
  severity: 'info' | 'warn' | 'error';
}

interface VerificationReport {
  docId: string;
  score: number;           // 0.0 ~ 1.0
  passed: boolean;
  issues: VerificationIssue[];
  verifiedAt: number;
}
```

## 파싱 규칙
```
- "Step N:" 또는 "단계 N:" 접두어로 단계 분리
- "(step K)" 또는 "[ref: K]" 문법으로 참조 추출
- 숫자 토큰 정규식 (\-?\d+(?:\.\d+)?) — claims 에 수치 포함
- "therefore|따라서|결론" 로 결론 식별
```

## 검증 규칙
```
1. missing-ref: 참조된 step 번호가 존재하지 않음
2. circular-ref: 참조 그래프 DFS 로 사이클 감지
3. numeric-inconsistency: 참조 단계 수치와 자기 수치가 불일치 (허용 오차 1%)
4. contradiction: 단계 텍스트에 "not ~ ...", "~ 이다" 와 반대 주장이 동시에 존재
5. orphan-step: 결론이 참조하지 않은 단계 (info)
6. unsupported-conclusion: 결론이 어떤 단계도 인용하지 않음 (error)

점수 계산: score = max(0, 1 - (#error × 0.25 + #warn × 0.1))
passed = score ≥ 0.7 && #error === 0
```

## 보안
- C/S 등급 document → throw `COT_GRADE_BLOCKED`
- 감사: VERIFY / ISSUE_FOUND / GRADE_BLOCK

## API
- `parse(text, docId, grade)` → CoTDocument
- `verify(doc)` → VerificationReport
- `verifyText(text, docId, grade)` → VerificationReport
- `getAuditLog()`
