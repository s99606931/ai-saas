# SVC-AI-ADV-R104 — AI Incident Response Playbook (Design)

> 작성일: 2026-04-12 | 버전: 2.0.0 (재작성)
> Plan Ref: SVC-AI-ADV-R104.plan.md

## 1. 아키텍처 옵션

- **Option A**: 외부 IRP(Incident Response Platform) 연동 — 외부 서비스 제약 위반
- **Option B (선정)**: 내부 정적 플레이북 + executor 주입형 단계 실행
- **Option C**: LLM 기반 동적 플레이북 생성 — 예측 불가

## 2. 구성 요소

### §2.1 Playbook / Step

```typescript
type IncidentSeverity = 'low' | 'medium' | 'high' | 'critical'

interface PlaybookStep {
  id: string
  description: string
  action: string // executor 키
  expectedOutcome?: string
}

interface Playbook {
  incidentType: string
  defaultSeverity: IncidentSeverity
  steps: PlaybookStep[]
}
```

### §2.2 Incident / Execution

- `incidentId`, `status: detected|in_progress|resolved|failed`
- `stepResults: Array<{stepId, success, output, at}>`

### §2.3 Triage

- 신호 키워드 매칭: "hallucination", "timeout", "bias", "poisoning" 등
- severity 판정: signal.severityHint > playbook.defaultSeverity

### §2.4 Executor 주입

```typescript
type StepExecutor = (action: string, context: Record<string, unknown>) =>
  Promise<{success: boolean; output: string}>
```

## 3. Session Guide

- 파일: `ai-incident-response-playbook.ts`
- 테스트: `__tests__/ai-incident-response-playbook.test.ts`

## 4. Design Anchor

- **CSAP D-06**: 모든 액션 감사 로그 필수 (침해사고 관리)
- **결정성**: executor 결과에 따른 실패 시 중단
