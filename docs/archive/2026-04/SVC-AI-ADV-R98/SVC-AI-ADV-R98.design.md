# SVC-AI-ADV-R98 — AI Onboarding Engine Design

## 인터페이스

```typescript
export interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  order: number;
  required: boolean;
}

export interface OnboardingProgress {
  userId: string;
  userRole: string;
  completedSteps: string[];
  startedAt: string;
  lastActiveAt: string;
}

export interface ProgressReport {
  userId: string;
  totalSteps: number;
  completedCount: number;
  requiredRemaining: number;
  completionRatio: number;
  durationMs: number;
}

export class AiOnboardingEngine {
  registerTemplate(userRole: string, steps: OnboardingStep[]): void;
  startOnboarding(userId: string, userRole: string): OnboardingProgress;
  completeStep(userId: string, stepId: string): OnboardingProgress;
  getNextStep(userId: string): OnboardingStep | null;
  progressReport(userId: string, now?: Date): ProgressReport;
}
```

## 로직

1. 템플릿은 role별 저장
2. progress는 사용자별 저장 (completedSteps array)
3. getNextStep: required 먼저, order 오름차순
4. 완료율 = required 제외 전체 기준

## 테스트

1. registerTemplate + startOnboarding
2. completeStep 진행
3. getNextStep 우선순위
4. progressReport 정확도
5. 미등록 role 예외
