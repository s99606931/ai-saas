# SVC-AI-ADV-R82 — Constitutional AI 자기 교정 (Design)

> v1.0.0 | 2026-04-12

## 차별화
- R53 self-correction-loop: 일반 Reflexion (환각 감소)
- 본 모듈: **명시적 원칙 목록** 기반 Critique→Revise, 공공기관 전용

## 인터페이스
```ts
export interface Principle {
  id: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  /** 주입형 검사 함수: 위반 시 이유 반환, 통과 시 null */
  check: (response: string) => string | null;
}

export interface ReviseFn {
  (query: string, response: string, violations: ViolationReport[]): Promise<string>;
}

export interface ViolationReport {
  principleId: string;
  reason: string;
  severity: 'low' | 'medium' | 'high';
}

export interface ConstitutionalResult {
  finalResponse: string;
  iterations: number;
  converged: boolean;
  violations: ViolationReport[][]; // per iteration
}
```

## 핵심 알고리즘
1. 초기 응답을 `response`로 세팅
2. 모든 principle.check 실행 → violations 수집
3. violations.length === 0 → 수렴 종료
4. iter < maxIter → reviseFn 호출하여 새 응답 생성, 반복
5. iter == maxIter 이며 여전히 위반 → failed (high severity 포함 시 원본 대신 "응답 불가" 메시지)

## 원칙 예시 (기본 탑재)
- P-NEUTRAL: 정치적 중립 (특정 정당 명시 금지)
- P-HARM: 폭력/차별 표현 금지
- P-PII: 주민번호/전화번호 정규식 탐지
- P-SECRET: 시스템 내부 경로/시크릿 노출 금지

## Session Guide
- 구현: `constitutional-ai-pipeline.ts`
- 테스트: `__tests__/constitutional-ai-pipeline.test.ts`
- Plan SC: FR-R82.1~5
