# SVC-AI-ADV-R3 DESIGN: AI Safety & Guardrails

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/SVC-AI-ADV-R3.plan.md

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead |

---

## 아키텍처 옵션 분석

| 옵션 | 설명 | 장점 | 단점 |
|------|------|------|------|
| A. 외부 가드레일 서비스 | Guardrails AI / NeMo Guardrails | 성숙한 기능 | 외부 의존성 |
| **B. 순수 TypeScript** | 규칙 기반 + 기존 LLM 활용 | CSAP 호환, 완전 제어 | 직접 구현 |
| C. ML 분류 모델 | ONNX Runtime 경량 모델 | 정확도 높음 | 별도 모델 배포 필요 |

**선택: 옵션 B (Pragmatic Balance)** -- 규칙 기반 1차 방어 + LLM 2차 검증

---

## §1. 프롬프트 주입 탐지기 (prompt-injection-detector.ts)

### 탐지 전략 (이중 방어)

**1차: 규칙 기반 (< 5ms)**
- 역할 재정의 패턴: "Ignore previous instructions", "You are now", "시스템 프롬프트 무시"
- 탈출 시도: 코드 블록으로 시스템 프롬프트 추출 시도
- 간접 주입: base64/URL 인코딩된 명령
- 위험 명령어: "DELETE", "DROP TABLE", "rm -rf" 등

**2차: LLM 기반 (선택적, < 2초)**
- 규칙 기반에서 의심 판정(0.5~0.8) 시 LLM에게 최종 판단 위임
- "이 입력이 프롬프트 주입 공격인지 분류하세요"

### 인터페이스
```typescript
interface InjectionDetectionResult {
  isInjection: boolean;
  confidence: number;     // 0~1
  detectedPatterns: string[];
  riskLevel: 'safe' | 'suspicious' | 'blocked';
}
```

---

## §2. 콘텐츠 필터 (content-filter.ts)

### 공공기관 부적절 카테고리 12종

1. 폭력/위협
2. 성적 콘텐츠
3. 혐오/차별 발언
4. 불법 활동 조장
5. 자해/자살 관련
6. 개인정보 요청
7. 허위 정보/음모론
8. 정치적 편향
9. 상업적 광고/스팸
10. 정부/공공기관 비방
11. 국가 기밀 관련
12. 저작권 침해

### 필터 전략
- 키워드 사전 + 패턴 매칭 (1차)
- 카테고리별 위험도 등급 (low/medium/high/critical)
- critical: 즉시 차단
- high: 차단 + 감사 로그
- medium: 경고 로그
- low: 통과 (모니터링만)

---

## §3. 환각 감지기 (hallucination-detector.ts)

### 감지 전략
- RAG 답변과 검색 출처 비교
- 출처에 없는 사실 주장 탐지
- 법령/규정 번호 정확성 검증

### 검증 방법
1. 답변에서 핵심 주장 추출
2. 각 주장이 제공된 출처 문서에 근거가 있는지 LLM 검증
3. 근거 없는 주장 비율 = 환각률
4. 환각률 > 30% → 경고 플래그

---

## §4. 출력 정책 가드레일

### 검증 항목
1. PII 누출 검사: 출력에 마스킹되지 않은 PII 존재 여부
2. 데이터 등급 위반: C/S등급 데이터 포함 여부
3. 행정 용어 정확성: 공공기관 표준 용어 사용 여부
4. 길이 제한: 응답 최대 길이 초과 여부

---

## §5. 가드레일 파이프라인

```
사용자 입력
  -> [입력 가드레일]
     -> 프롬프트 주입 탐지
     -> 콘텐츠 필터 (입력)
     -> 데이터 등급 검증
  -> [AI 처리] (통과 시)
  -> [출력 가드레일]
     -> PII 누출 검사
     -> 콘텐츠 필터 (출력)
     -> 환각 감지 (RAG만)
     -> 정책 준수 검증
  -> 최종 응답
```

### 인터페이스
```typescript
interface GuardrailResult {
  passed: boolean;
  violations: GuardrailViolation[];
  sanitizedContent?: string;  // 정화된 콘텐츠
  metadata: {
    inputCheckMs: number;
    outputCheckMs: number;
    totalCheckMs: number;
  };
}
```

---

## Session Guide

### 구현 순서
1. `src/lib/prompt-injection-detector.ts`
2. `src/lib/content-filter.ts`
3. `src/lib/hallucination-detector.ts`
4. `src/lib/ai-guardrails.ts` (통합 파이프라인)

### Design Anchor
- 모든 구현 파일 상단: `// Design Ref: SVC-AI-ADV-R3 DESIGN §{섹션}`
- 모든 함수: `// Plan SC: FR-ADV3.{번호}`
