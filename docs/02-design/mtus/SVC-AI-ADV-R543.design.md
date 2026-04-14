# SVC-AI-ADV-R543 Design — 공공문서 진위 검증

## 인터페이스

```typescript
interface DocumentInput {
  documentId: string;
  issuedBy: string;
  issuedAt: string;
  checksum: string;
  requiredFields: string[];
  presentFields: string[];
}

interface AuthenticityResult {
  documentId: string;
  verdict: 'AUTHENTIC' | 'INCOMPLETE' | 'TAMPERED';
  missingFields: string[];
  checksumValid: boolean;
}
```

## 핵심 알고리즘

- 필드 완전성: requiredFields의 모든 항목이 presentFields에 포함 여부
- 체크섬 유효: /^[0-9a-fA-F]{16,}$/ 패턴 검사
- 판정: 필드완전+체크섬유효→AUTHENTIC / 필드불완전→INCOMPLETE / 체크섬무효→TAMPERED
  (필드 불완전이 우선, 체크섬 오류가 있어도 필드 먼저 확인)
- 감사 로그: verify 호출 시 전수 기록

## CSAP 참조
- D-06: 감사 로그 전수 기록
