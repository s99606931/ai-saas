# TypeScript 심화 패턴 완전 가이드

> 공공기관 SaaS 프레임워크 — 고급 타입 시스템, 타입 안전 API, 컴파일러 활용
> Design Ref: 실제 프로젝트 코드 분석 기반 (feature-flag-sdk, escalation-controller, model-ci)
> 작성일: 2026-04-13 | 대상: TypeScript 중급 이상 개발자

---

## 목차

1. [TypeScript 고급 타입 시스템 전체 맵](#1-typescript-고급-타입-시스템-전체-맵)
2. [feature-flag-sdk 실제 코드 분석](#2-feature-flag-sdk-실제-코드-분석)
3. [escalation-controller.ts 실제 코드 분석](#3-escalation-controllerts-실제-코드-분석)
4. [model-ci.ts 실제 코드 분석](#4-model-cits-실제-코드-분석)
5. [Branded Type 패턴](#5-branded-type-패턴)
6. [Template Literal Types 심화](#6-template-literal-types-심화)
7. [Conditional Types 심화](#7-conditional-types-심화)
8. [satisfies 연산자](#8-satisfies-연산자)
9. [타입 안전 이벤트 버스 패턴](#9-타입-안전-이벤트-버스-패턴)
10. [타입 에러 디버깅 10가지](#10-타입-에러-디버깅-10가지)
11. [tsconfig 최적화](#11-tsconfig-최적화)
12. [TypeScript 성능 최적화](#12-typescript-성능-최적화)

---

## 1. TypeScript 고급 타입 시스템 전체 맵

TypeScript의 타입 시스템은 단순한 타입 선언을 넘어 복잡한 비즈니스 로직을 타입 수준에서 표현할 수 있는 강력한 도구입니다. 아래 다이어그램은 이 가이드에서 다루는 고급 타입 기법들의 관계를 보여줍니다.

```mermaid
graph TD
    subgraph "기본 타입 레이어"
        A[Primitive Types<br/>string, number, boolean]
        B[Union Types<br/>A | B | C]
        C[Intersection Types<br/>A & B & C]
    end

    subgraph "고급 타입 구성 레이어"
        D[Branded Types<br/>TenantId, UserId, TraceId]
        E[Discriminated Union<br/>action: 'created' | 'updated']
        F[Template Literal Types<br/>'/api/${string}']
        G[Conditional Types<br/>T extends U ? X : Y]
    end

    subgraph "추론 및 변환 레이어"
        H[infer 키워드<br/>ReturnType, Awaited]
        I[Mapped Types<br/>Partial, Required, Readonly]
        J[z.infer<typeof Schema><br/>Zod 런타임 검증 연동]
    end

    subgraph "패턴 레이어"
        K[Result Pattern<br/>Ok / Err 타입 분기]
        L[Builder Pattern<br/>메서드 체이닝 타입]
        M[Event Bus Pattern<br/>이벤트→페이로드 매핑]
        N[satisfies 연산자<br/>타입 좁히기 유지]
    end

    A --> D
    B --> E
    A --> F
    G --> H
    G --> I
    J --> E

    D --> K
    E --> K
    F --> M
    H --> K
    I --> L

    K --> N
    L --> N
    M --> N

    style D fill:#FF6B6B,color:#fff
    style E fill:#4ECDC4,color:#fff
    style J fill:#45B7D1,color:#fff
    style K fill:#96CEB4,color:#fff
    style N fill:#FFEAA7,color:#333
```

### 1.1 타입 시스템을 사용하는 이유

TypeScript를 단순히 "타입이 있는 JavaScript"로 사용하면 그 가치의 20%만 활용하는 것입니다. 고급 타입 시스템을 활용하면:

- **런타임 에러를 컴파일 타임에 발견**: 잘못된 TenantId를 UserId 자리에 넣는 실수를 컴파일러가 차단
- **문서화 자동화**: 타입 자체가 함수의 계약(contract)이 됨
- **리팩토링 안전성**: 타입 변경 시 영향 범위를 컴파일러가 자동으로 찾아줌
- **CSAP D-12 준수**: 입력 검증 로직을 타입으로 강제할 수 있음

---

## 2. feature-flag-sdk 실제 코드 분석

실제 프로젝트 파일 `/data/ai-saas/packages/feature-flag-sdk/src/index.ts`를 분석하여 인터페이스 설계 패턴을 학습합니다.

### 2.1 인터페이스 분리 원칙 적용

`feature-flag-sdk`는 인터페이스 분리 원칙(Interface Segregation Principle)을 잘 보여줍니다.

```typescript
// 실제 코드: packages/feature-flag-sdk/src/index.ts

// 설정(Config) 인터페이스 — 초기화에만 사용
export interface FeatureFlagConfig {
  apiUrl: string;
  apiKey: string;          // 환경 변수에서 주입, CSAP D-09
  appName: string;
  refreshInterval?: number;   // 선택적 필드에 기본값 의미 부여
  metricsInterval?: number;
}

// 컨텍스트(Context) 인터페이스 — 평가 시에만 사용
export interface FeatureFlagContext {
  userId?: string;
  tenantId?: string;
  environment?: string;
  properties?: Record<string, string>;
}

// 평가(Evaluation) 인터페이스 — 결과값 표현
export interface FeatureFlagEvaluation {
  flagName: string;
  enabled: boolean;
  variant?: string;
  evaluatedAt: string;    // ISO 8601 문자열
  context?: FeatureFlagContext;
}
```

**핵심 설계 원칙**: 하나의 거대한 인터페이스 대신 역할별로 분리합니다. `FeatureFlagConfig`는 초기화에, `FeatureFlagContext`는 평가 호출에, `FeatureFlagEvaluation`은 결과 표현에 각각 사용됩니다.

### 2.2 추상화 인터페이스 패턴

```typescript
// 실제 코드: IFeatureFlagClient 인터페이스
export interface IFeatureFlagClient {
  initialize(): Promise<void>;
  isEnabled(flagName: string, context?: FeatureFlagContext): boolean;
  getVariant(flagName: string, context?: FeatureFlagContext): string | undefined;
  getActiveFlags(): string[];
  destroy(): void;
}
```

이 인터페이스 패턴의 장점을 분석해봅니다:

1. **구현체 교체 가능성**: `UnleashFeatureFlagClient` 대신 LaunchDarkly나 자체 구현체로 교체 시 인터페이스를 그대로 유지
2. **테스트 용이성**: Mock 객체 생성이 간단함
3. **의존성 역전**: 상위 레이어는 `IFeatureFlagClient`에만 의존

```typescript
// 테스트에서 Mock 구현체 사용 예시
class MockFeatureFlagClient implements IFeatureFlagClient {
  private flags = new Map<string, boolean>();

  async initialize(): Promise<void> {
    // 테스트에서는 즉시 완료
  }

  isEnabled(flagName: string): boolean {
    return this.flags.get(flagName) ?? false;
  }

  getVariant(_flagName: string): string | undefined {
    return undefined;
  }

  getActiveFlags(): string[] {
    return Array.from(this.flags.entries())
      .filter(([, v]) => v)
      .map(([k]) => k);
  }

  destroy(): void {
    this.flags.clear();
  }

  // 테스트 전용 헬퍼 메서드
  setFlag(name: string, enabled: boolean): void {
    this.flags.set(name, enabled);
  }
}

// 테스트 코드
describe('FeatureFlagService', () => {
  it('새로운 기능이 비활성화된 경우 구 기능을 사용한다', () => {
    const client = new MockFeatureFlagClient();
    client.setFlag('new-payment-flow', false);

    const service = new PaymentService(client);
    expect(service.getActiveFlow()).toBe('legacy');
  });
});
```

### 2.3 Discriminated Union으로 이벤트 타입 표현

실제 코드의 `FlagChangeEvent` 인터페이스에서 Discriminated Union을 더욱 강화하는 방법:

```typescript
// 실제 코드: FlagChangeEvent (단순 union)
export interface FlagChangeEvent {
  flagName: string;
  action: 'created' | 'updated' | 'deleted' | 'toggled';
  newState: boolean;
  actor: string;
  timestamp: string;
}

// 개선 버전: Discriminated Union으로 각 action에 다른 페이로드 강제
type FlagCreatedEvent = {
  action: 'created';
  flagName: string;
  initialState: boolean;
  description: string;     // 생성 시 설명 필수
  actor: string;
  timestamp: string;
};

type FlagUpdatedEvent = {
  action: 'updated';
  flagName: string;
  previousState: boolean;  // 이전 상태 기록
  newState: boolean;
  changeReason: string;    // 변경 이유 필수 (CSAP D-06 감사 요건)
  actor: string;
  timestamp: string;
};

type FlagDeletedEvent = {
  action: 'deleted';
  flagName: string;
  lastState: boolean;
  actor: string;
  timestamp: string;
};

type FlagToggledEvent = {
  action: 'toggled';
  flagName: string;
  newState: boolean;
  actor: string;
  timestamp: string;
};

// 모든 이벤트 타입의 합집합
type FlagChangeEvent = 
  | FlagCreatedEvent 
  | FlagUpdatedEvent 
  | FlagDeletedEvent 
  | FlagToggledEvent;

// 사용: TypeScript가 action에 따라 올바른 타입을 자동으로 좁혀줌
function processEvent(event: FlagChangeEvent): string {
  switch (event.action) {
    case 'created':
      // 여기서 event는 FlagCreatedEvent 타입
      return `플래그 생성: ${event.flagName} (${event.description})`;
    
    case 'updated':
      // 여기서 event는 FlagUpdatedEvent 타입
      return `플래그 변경: ${event.flagName} ${event.previousState} → ${event.newState}`;
    
    case 'deleted':
      // 여기서 event는 FlagDeletedEvent 타입
      return `플래그 삭제: ${event.flagName}`;
    
    case 'toggled':
      return `플래그 토글: ${event.flagName} → ${event.newState}`;
  }
}
```

### 2.4 Required와 Partial을 활용한 설정 패턴

실제 코드에서 `Required<FeatureFlagConfig>` 패턴을 사용합니다:

```typescript
// 실제 코드: config를 Required<>로 명시적 변환
export class UnleashFeatureFlagClient implements IFeatureFlagClient {
  private config: Required<FeatureFlagConfig>;  // 모든 필드가 반드시 존재

  constructor(config: FeatureFlagConfig) {
    this.config = {
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
      appName: config.appName,
      refreshInterval: config.refreshInterval ?? 15000,  // 기본값 주입
      metricsInterval: config.metricsInterval ?? 60000,
    };
  }
}
```

**학습 포인트**: `FeatureFlagConfig`에서 `refreshInterval`이 `number | undefined`이지만, 생성자에서 기본값을 주입하여 내부적으로는 항상 `number`로 사용합니다. `Required<>` 유틸리티 타입이 이를 명확히 표현합니다.

```typescript
// Required<T> 작동 방식 이해
type FeatureFlagConfig = {
  apiUrl: string;
  refreshInterval?: number;  // optional
};

type RequiredConfig = Required<FeatureFlagConfig>;
// 결과: { apiUrl: string; refreshInterval: number; }
// optional이 제거됨

// 반대로 모든 필드를 optional로 만들기
type PartialConfig = Partial<FeatureFlagConfig>;
// 결과: { apiUrl?: string; refreshInterval?: number; }

// 일부 필드만 필수, 나머지는 선택적으로 만들기
type ConfigWithRequiredUrl = Required<Pick<FeatureFlagConfig, 'apiUrl'>>
  & Partial<Omit<FeatureFlagConfig, 'apiUrl'>>;
```

---

## 3. escalation-controller.ts 실제 코드 분석

실제 프로젝트 파일 `/data/ai-saas/packages/slo-escalation/src/escalation-controller.ts`에서 Zod 스키마와 TypeScript 타입 자동 추출 패턴을 분석합니다.

### 3.1 Zod 스키마 → TypeScript 타입 자동 추출

```typescript
// 실제 코드: escalation-controller.ts
import { z } from 'zod';

// 1단계: Zod 스키마로 런타임 검증 규칙 정의
const EscalationPolicySchema = z.object({
  name: z.string(),
  service: z.string(),
  levels: z.array(
    z.object({
      level: z.nativeEnum(EscalationLevel),
      budgetBurnRateMin: z.number().min(0).max(200),
      budgetBurnRateMax: z.number().min(0).max(200),
      contacts: z.array(
        z.object({
          name: z.string(),
          channel: z.nativeEnum(NotificationChannel),
          target: z.string(),
        }),
      ),
      waitMinutes: z.number().min(0),
      actions: z.array(z.string()).optional(),
    }),
  ),
});

// 2단계: z.infer로 TypeScript 타입 자동 생성 (중복 정의 불필요!)
export type EscalationPolicy = z.infer<typeof EscalationPolicySchema>;
//          ^^^^^^^^^^^^^^^^
// 이 타입은 스키마에서 자동 생성됨.
// 스키마를 바꾸면 타입도 자동으로 바뀜 — 코드 중복 없음!
```

**왜 이 패턴이 중요한가?**

기존 방식(타입과 검증 로직을 별도로 작성)의 문제점:

```typescript
// 나쁜 예시: 타입 정의와 검증 로직이 분리됨
interface EscalationPolicy {
  name: string;
  service: string;
  // ... 여기서 타입 정의
}

function validateEscalationPolicy(data: unknown): EscalationPolicy {
  // 타입 정의를 반복해야 함 — 변경 시 두 곳을 동시에 수정해야 하는 위험
  if (typeof data !== 'object' || data === null) {
    throw new Error('Invalid data');
  }
  if (typeof (data as any).name !== 'string') {
    throw new Error('name must be string');
  }
  // ... 끝없는 수동 검증
  return data as EscalationPolicy;  // as 캐스팅 사용 — 불안전
}
```

Zod 방식의 장점:

```typescript
// 좋은 예시: Zod로 한 번만 정의 — 타입 + 검증 동시에
const EscalationPolicySchema = z.object({
  name: z.string().min(1, '이름은 필수입니다'),
  budgetBurnRateMin: z.number().min(0).max(200),
});

// 타입은 자동 생성
type EscalationPolicy = z.infer<typeof EscalationPolicySchema>;

// 검증은 .parse() 또는 .safeParse()
function processPolicy(rawData: unknown) {
  const policy = EscalationPolicySchema.parse(rawData);
  // policy는 이제 완전히 타입 안전한 EscalationPolicy
  // 검증 실패 시 ZodError 자동 발생 — as 캐스팅 불필요
}
```

### 3.2 enum → Zod nativeEnum 패턴

```typescript
// 실제 코드: TypeScript enum을 Zod 스키마에서 재사용
export enum EscalationLevel {
  Normal = 'normal',
  Warning = 'warning',
  Danger = 'danger',
  Critical = 'critical',
  Violated = 'violated',
}

// z.nativeEnum으로 enum 값을 Zod 스키마에 통합
const schema = z.object({
  level: z.nativeEnum(EscalationLevel),  // 유효한 enum 값만 허용
});

// 타입은 자동으로 EscalationLevel이 됨
type PolicyLevel = z.infer<typeof schema>;
// { level: EscalationLevel }

// 런타임 검증: 'invalid' 값이 들어오면 ZodError 발생
schema.parse({ level: 'normal' });   // OK — EscalationLevel.Normal과 동일
schema.parse({ level: 'invalid' });  // ZodError — 유효하지 않은 enum 값
```

### 3.3 registerPolicy()의 이중 검증 패턴

```typescript
// 실제 코드: 런타임 재검증으로 방어적 프로그래밍 구현
registerPolicy(policy: EscalationPolicy): void {
  // TypeScript가 이미 EscalationPolicy 타입을 보장하지만...
  const validated = EscalationPolicySchema.parse(policy);
  // ...외부에서 오는 데이터는 다시 한번 Zod로 런타임 검증
  // CSAP D-12: 모든 입력에 검증 적용
  this.policies.set(validated.service, validated);
}
```

이 패턴은 "Defense in Depth(심층 방어)" 원칙을 구현합니다. TypeScript 타입 체크는 컴파일 타임에만 동작하므로, 런타임에 외부 API나 사용자 입력에서 오는 데이터는 Zod로 다시 검증해야 합니다.

### 3.4 레코드 타입으로 enum 매핑

```typescript
// 실제 코드: Record<EscalationLevel, string>으로 완전한 매핑 강제
private getLevelLabel(level: EscalationLevel): string {
  const labels: Record<EscalationLevel, string> = {
    [EscalationLevel.Normal]: '정상',
    [EscalationLevel.Warning]: '경고',
    [EscalationLevel.Danger]: '위험',
    [EscalationLevel.Critical]: '긴급',
    [EscalationLevel.Violated]: 'SLO 위반',
  };
  return labels[level];
}
```

**핵심 포인트**: `Record<EscalationLevel, string>` 타입을 사용하면 TypeScript 컴파일러가 `EscalationLevel`의 모든 케이스에 대한 매핑이 존재하는지 검사합니다. 새로운 enum 값을 추가하면 컴파일 에러로 즉시 알려줍니다.

```typescript
// 새 값 추가 시 Record 타입이 컴파일 에러로 보호
export enum EscalationLevel {
  Normal = 'normal',
  // ... 기존 값들 ...
  Resolved = 'resolved',  // 새로 추가!
}

// labels 객체에 Resolved 케이스가 없으면 컴파일 에러:
// "Property 'resolved' is missing in type"
const labels: Record<EscalationLevel, string> = {
  [EscalationLevel.Normal]: '정상',
  // EscalationLevel.Resolved가 없어서 오류 발생
};
```

---

## 4. model-ci.ts 실제 코드 분석

실제 프로젝트 파일 `/data/ai-saas/packages/ml-pipeline/src/model-ci.ts`에서 제네릭 타입 활용과 타입 안전 파이프라인 패턴을 분석합니다.

### 4.1 Zod 스키마 기반 입력 타입 설계

```typescript
// 실제 코드: model-ci.ts
import { z } from 'zod';

const ModelTrainRequestSchema = z.object({
  experimentName: z.string().min(1),
  modelName: z.string().min(1),
  params: z.record(z.union([z.string(), z.number(), z.boolean()])),
  metrics: z.record(z.number()),
  artifactPath: z.string(),
  tags: z.record(z.string()).optional(),
});

export type ModelTrainRequest = z.infer<typeof ModelTrainRequestSchema>;
```

`z.record(z.union([z.string(), z.number(), z.boolean()]))` 패턴 분석:

```typescript
// z.record(V) = Record<string, V> 타입을 생성하는 Zod 스키마
// z.union([A, B, C]) = A | B | C 타입을 생성하는 Zod 스키마

// 따라서 ModelTrainRequest.params의 타입은:
// Record<string, string | number | boolean>

// 실제 사용 예시:
const request: ModelTrainRequest = {
  experimentName: 'fraud-detection-v2',
  modelName: 'xgboost-fraud',
  params: {
    learning_rate: 0.01,      // number OK
    max_depth: 6,             // number OK
    objective: 'binary:logistic', // string OK
    use_gpu: false,           // boolean OK
  },
  metrics: {
    accuracy: 0.95,           // Record<string, number>
    f1_score: 0.93,
  },
  artifactPath: '/mlflow/artifacts/run_001',
};
```

### 4.2 인터페이스를 통한 타입 안전 파이프라인

```typescript
// 실제 코드: ModelValidationCriteria 인터페이스
export interface ModelValidationCriteria {
  minAccuracy: number;
  maxInferenceTimeMs: number;
  maxModelSizeMb: number;
  requiredMetrics: string[];
}

const DEFAULT_VALIDATION_CRITERIA: ModelValidationCriteria = {
  minAccuracy: 0.85,
  maxInferenceTimeMs: 100,
  maxModelSizeMb: 500,
  requiredMetrics: ['accuracy', 'f1_score', 'precision', 'recall'],
};
```

파이프라인 단계별 반환 타입 분석:

```typescript
// 단계 1: logTrainingRun() → { runId: string }
async logTrainingRun(request: ModelTrainRequest): Promise<{ runId: string }>

// 단계 2: validateModel() → { passed: boolean; reasons: string[] }
async validateModel(
  runId: string,
  metrics: Record<string, number>,
  modelSizeMb: number,
  inferenceTimeMs: number,
): Promise<{ passed: boolean; reasons: string[] }>

// 단계 3: registerModel() → { version: number; stage: ModelStage }
async registerModel(
  runId: string,
  modelName: string,
  stage: ModelStage,
): Promise<{ version: number; stage: ModelStage }>

// 단계 4: promoteModel() → { success: boolean }
async promoteModel(
  modelName: string,
  version: number,
  targetStage: ModelStage,
): Promise<{ success: boolean }>
```

### 4.3 제네릭 파이프라인으로 확장

실제 코드를 기반으로 제네릭을 활용한 타입 안전 파이프라인을 구현하면:

```typescript
// 파이프라인 단계 타입 정의
type PipelineStep<TInput, TOutput> = {
  name: string;
  execute(input: TInput): Promise<TOutput>;
};

// 두 단계를 연결하는 제네릭 함수
function pipe<A, B, C>(
  step1: PipelineStep<A, B>,
  step2: PipelineStep<B, C>
): PipelineStep<A, C> {
  return {
    name: `${step1.name} → ${step2.name}`,
    async execute(input: A): Promise<C> {
      const intermediate = await step1.execute(input);
      return step2.execute(intermediate);
    },
  };
}

// 세 단계를 연결하는 오버로드
function pipe<A, B, C, D>(
  step1: PipelineStep<A, B>,
  step2: PipelineStep<B, C>,
  step3: PipelineStep<C, D>
): PipelineStep<A, D>;

// 실제 ML 파이프라인 적용 예시
const trainingPipeline = pipe(
  { name: 'log', execute: (req: ModelTrainRequest) => pipeline.logTrainingRun(req) },
  { name: 'validate', execute: (result: { runId: string }) => 
      pipeline.validateModel(result.runId, {}, 100, 50) }
);

// TypeScript가 입출력 타입을 자동으로 추론
const result = await trainingPipeline.execute(trainRequest);
// result: { passed: boolean; reasons: string[] }
```

### 4.4 ModelStage enum의 타입 안전 전이 규칙

```typescript
// 실제 코드: ModelStage enum
export enum ModelStage {
  None = 'None',
  Staging = 'Staging',
  Production = 'Production',
  Archived = 'Archived',
}

// 타입 시스템으로 유효한 전이만 허용하는 방법
type ValidTransitions = {
  None: ['Staging'];
  Staging: ['Production', 'Archived'];
  Production: ['Archived'];
  Archived: [];  // 최종 상태
};

// Transition<From> = 해당 단계에서 전환 가능한 다음 단계들
type Transition<From extends ModelStage> =
  ValidTransitions[From] extends (infer T)[]
    ? T
    : never;

// 컴파일 타임에 유효한 전이만 허용
async function safePromote<From extends ModelStage>(
  modelName: string,
  version: number,
  from: From,
  to: Transition<From>,
): Promise<{ success: boolean }> {
  // TypeScript가 to 파라미터의 유효한 값을 강제함
  return pipeline.promoteModel(modelName, version, to as ModelStage);
}

// 사용 예시
safePromote('fraud-model', 3, ModelStage.Staging, ModelStage.Production); // OK
safePromote('fraud-model', 3, ModelStage.None, ModelStage.Production);    // 컴파일 에러!
```

---

## 5. Branded Type 패턴

Branded Type은 같은 primitive 타입(예: string)을 가지지만 의미적으로 다른 값들을 컴파일 타임에 구분하는 패턴입니다.

### 5.1 문제 상황: 타입 혼동

```typescript
// 문제: 모든 ID가 string이라 혼동 가능
function getUser(userId: string, tenantId: string): User { ... }

// 실수로 파라미터 순서를 바꿔도 컴파일러가 잡지 못함
getUser(tenantId, userId);  // 런타임에만 버그 발견!
```

### 5.2 Branded Type 구현

```typescript
// Branded Type 기반 구조
declare const __brand: unique symbol;

type Brand<T, TBrand extends string> = T & {
  readonly [__brand]: TBrand;
};

// 공공기관 SaaS 플랫폼 전용 ID 타입들
type TenantId = Brand<string, 'TenantId'>;
type UserId = Brand<string, 'UserId'>;
type TraceId = Brand<string, 'TraceId'>;
type SessionId = Brand<string, 'SessionId'>;
type AuditLogId = Brand<string, 'AuditLogId'>;

// 생성 함수 — 검증 포함
function createTenantId(raw: string): TenantId {
  if (!raw.startsWith('tenant_')) {
    throw new Error(`유효하지 않은 TenantId 형식: ${raw}`);
  }
  return raw as TenantId;
}

function createUserId(raw: string): UserId {
  if (!raw.startsWith('user_')) {
    throw new Error(`유효하지 않은 UserId 형식: ${raw}`);
  }
  return raw as UserId;
}

function createTraceId(): TraceId {
  return `trace_${Date.now()}_${Math.random().toString(36).slice(2)}` as TraceId;
}

// 이제 컴파일러가 혼동을 차단!
function getUser(userId: UserId, tenantId: TenantId): Promise<User> {
  // ...
}

const userId = createUserId('user_abc123');
const tenantId = createTenantId('tenant_xyz789');

getUser(userId, tenantId);   // OK
getUser(tenantId, userId);   // 컴파일 에러! TenantId를 UserId 자리에 사용 불가
```

### 5.3 Zod와 Branded Type 통합

```typescript
import { z } from 'zod';

// Zod 스키마에서 Branded Type 자동 생성
const TenantIdSchema = z.string().startsWith('tenant_').brand<'TenantId'>();
const UserIdSchema = z.string().startsWith('user_').brand<'UserId'>();

type TenantId = z.infer<typeof TenantIdSchema>;
type UserId = z.infer<typeof UserIdSchema>;

// API 요청 스키마에서 자동으로 Branded Type 사용
const CreatePostSchema = z.object({
  authorId: UserIdSchema,    // UserId Branded Type
  tenantId: TenantIdSchema,  // TenantId Branded Type
  title: z.string().min(1).max(200),
  content: z.string().min(10),
});

type CreatePostRequest = z.infer<typeof CreatePostSchema>;
// { authorId: UserId, tenantId: TenantId, title: string, content: string }

// Zod parse가 자동으로 Branded Type으로 변환
async function createPost(rawRequest: unknown): Promise<Post> {
  const request = CreatePostSchema.parse(rawRequest);
  // request.authorId는 이제 UserId Branded Type — 타입 안전!
  return postRepository.create(request);
}
```

### 5.4 Nominal Typing 패턴 비교

```typescript
// 방법 1: Brand (앞서 본 방법) — 가장 간단
type TenantId1 = Brand<string, 'TenantId'>;

// 방법 2: Unique Symbol — 더 강력한 격리
declare const TenantIdSymbol: unique symbol;
type TenantId2 = string & { readonly _type: typeof TenantIdSymbol };

// 방법 3: 클래스 — 런타임 오버헤드가 있지만 추가 메서드 가능
class TenantId3 {
  private constructor(private readonly value: string) {}

  static create(raw: string): TenantId3 {
    if (!raw.match(/^tenant_[a-z0-9]+$/)) {
      throw new Error('Invalid TenantId format');
    }
    return new TenantId3(raw);
  }

  toString(): string {
    return this.value;
  }

  equals(other: TenantId3): boolean {
    return this.value === other.value;
  }
}

// 공공기관 SaaS에서 권장하는 방법: 방법 1 (Brand) + Zod 통합
// 이유: 런타임 오버헤드 없이 컴파일 타임 안전성 확보
```

---

## 6. Template Literal Types 심화

Template Literal Types는 TypeScript 4.1에서 도입된 기능으로, 문자열 리터럴 타입을 조합하여 새로운 타입을 생성합니다.

### 6.1 URL 경로 타입 안전화

```typescript
// API 경로를 타입으로 표현
type ApiVersion = 'v1' | 'v2' | 'v3';
type ApiResource = 'tenants' | 'users' | 'policies' | 'audit-logs';
type ApiPath = `/api/${ApiVersion}/${ApiResource}`;

// 유효한 경로 자동 완성: '/api/v1/tenants', '/api/v2/users', ...
const validPath: ApiPath = '/api/v1/tenants';   // OK
const invalidPath: ApiPath = '/api/v4/tenants'; // 컴파일 에러!

// 더 복잡한 경로 패턴
type ResourcePath<R extends ApiResource> = `/api/v1/${R}/${string}`;
type TenantPath = ResourcePath<'tenants'>;
// '/api/v1/tenants/tenant_abc123', '/api/v1/tenants/tenant_xyz789' 등
```

### 6.2 이벤트 이름 자동 완성

```typescript
// 도메인 이벤트 이름 타입 자동 생성
type EventEntity = 'User' | 'Tenant' | 'Policy' | 'AuditLog' | 'FeatureFlag';
type EventAction = 'Created' | 'Updated' | 'Deleted' | 'Activated' | 'Deactivated';

type DomainEventName = `${EventEntity}${EventAction}`;
// 'UserCreated' | 'UserUpdated' | 'UserDeleted' | 'UserActivated' | ...
// 모든 조합이 자동으로 생성됨 (5 × 5 = 25개)

// 실제 이벤트 핸들러 타입
type EventHandler<TEventName extends DomainEventName> = {
  eventName: TEventName;
  handle(event: DomainEvent<TEventName>): Promise<void>;
};

// 이벤트 이름에서 페이로드 타입을 추출하는 조건부 타입
type EventPayload<T extends DomainEventName> =
  T extends `User${string}` ? UserEventPayload :
  T extends `Tenant${string}` ? TenantEventPayload :
  T extends `Policy${string}` ? PolicyEventPayload :
  never;

// 사용 예시: 이벤트 이름에 따라 페이로드 타입이 자동으로 결정됨
function subscribe<T extends DomainEventName>(
  eventName: T,
  handler: (payload: EventPayload<T>) => void
): void {
  // 내부 구현
}

subscribe('UserCreated', (payload) => {
  // payload는 UserEventPayload 타입으로 자동 추론됨
  console.log(payload.userId);  // 자동 완성 지원!
});
```

### 6.3 CSS-in-JS 스타일 타입

```typescript
// CSAP 공공기관 UI 컴포넌트 색상 시스템
type ColorScale = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;
type ColorName = 'gray' | 'blue' | 'green' | 'red' | 'yellow' | 'purple';

type ColorToken = `${ColorName}-${ColorScale}`;
// 'gray-50' | 'gray-100' | ... | 'purple-900' (자동으로 60개 조합)

// 스페이싱 타입
type SpacingSize = 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16;
type SpacingProperty = 'p' | 'px' | 'py' | 'pt' | 'pb' | 'pl' | 'pr'
                     | 'm' | 'mx' | 'my' | 'mt' | 'mb' | 'ml' | 'mr';
type SpacingClass = `${SpacingProperty}-${SpacingSize}`;

// 컴포넌트 props에서 타입 안전 클래스 사용
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger';
  size: 'sm' | 'md' | 'lg';
  padding?: SpacingClass;     // 'p-4', 'px-6' 등만 허용
  textColor?: ColorToken;      // 'blue-600', 'red-500' 등만 허용
}
```

### 6.4 Getter/Setter 이름 자동 생성

```typescript
// 프로퍼티 이름에서 getter/setter 이름 자동 생성
type Getter<T extends string> = `get${Capitalize<T>}`;
type Setter<T extends string> = `set${Capitalize<T>}`;

// Capitalize<'name'> = 'Name'
// Getter<'name'> = 'getName'
// Setter<'name'> = 'setName'

type Accessors<T extends Record<string, unknown>> = {
  [K in keyof T as Getter<string & K>]: () => T[K];
} & {
  [K in keyof T as Setter<string & K>]: (value: T[K]) => void;
};

interface UserState {
  name: string;
  email: string;
  tenantId: string;
}

type UserAccessors = Accessors<UserState>;
// {
//   getName: () => string;
//   setName: (value: string) => void;
//   getEmail: () => string;
//   setEmail: (value: string) => void;
//   getTenantId: () => string;
//   setTenantId: (value: string) => void;
// }
```

---

## 7. Conditional Types 심화

Conditional Types는 타입 수준의 if-else 표현식입니다.

### 7.1 기본 문법

```typescript
// 기본 형태: T extends U ? X : Y
// T가 U에 할당 가능하면 X, 아니면 Y

type IsString<T> = T extends string ? true : false;

type A = IsString<string>;   // true
type B = IsString<number>;   // false
type C = IsString<'hello'>;  // true (string 리터럴도 string에 할당 가능)
```

### 7.2 infer 키워드

`infer`는 Conditional Types 내에서 타입을 추론하는 키워드입니다.

```typescript
// 함수 반환 타입 추출 (ReturnType 구현 원리)
type MyReturnType<T> = T extends (...args: unknown[]) => infer R ? R : never;

// 비동기 함수의 반환 타입 추출
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

// 배열 요소 타입 추출
type ElementType<T> = T extends (infer E)[] ? E : never;

// 실제 사용 예시
type RunRAGResult = UnwrapPromise<ReturnType<typeof runRAG>>;
// RAGResponse 타입이 자동으로 추출됨

// 중첩 Promise도 처리
type DeepUnwrap<T> = T extends Promise<infer U> ? DeepUnwrap<U> : T;
type Result = DeepUnwrap<Promise<Promise<string>>>;  // string
```

### 7.3 재귀 Conditional Types

```typescript
// 재귀적으로 중첩된 타입을 평탄화
type Flatten<T> = T extends Array<infer Item> ? Flatten<Item> : T;

type A = Flatten<number[][][]>;  // number
type B = Flatten<string[]>;      // string
type C = Flatten<boolean>;       // boolean (배열이 아님)

// JSON 타입 재귀 정의
type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

// 깊은 Partial (중첩 객체도 모두 optional로)
type DeepPartial<T> = T extends object
  ? { [P in keyof T]?: DeepPartial<T[P]> }
  : T;

interface Config {
  database: {
    host: string;
    port: number;
    credentials: {
      username: string;
      password: string;
    };
  };
  cache: {
    ttl: number;
    maxSize: number;
  };
}

type PartialConfig = DeepPartial<Config>;
// {
//   database?: {
//     host?: string;
//     port?: number;
//     credentials?: {
//       username?: string;
//       password?: string;
//     };
//   };
//   cache?: { ... };
// }
```

### 7.4 분배 Conditional Types

```typescript
// Conditional Types는 union에 대해 분배적으로 작용함
type ToArray<T> = T extends unknown ? T[] : never;

type A = ToArray<string | number>;
// string[] | number[]  (각 유니온 멤버에 따로 적용됨)
// NOT: (string | number)[]

// 분배를 막으려면 대괄호로 감싸기
type ToArrayNonDist<T> = [T] extends [unknown] ? T[] : never;

type B = ToArrayNonDist<string | number>;
// (string | number)[]

// 실용적인 예시: union에서 특정 타입 제거
type ExcludeNull<T> = T extends null | undefined ? never : T;

type WithNull = string | number | null | undefined;
type WithoutNull = ExcludeNull<WithNull>;  // string | number
```

---

## 8. satisfies 연산자

TypeScript 4.9에서 도입된 `satisfies`는 타입 주석과 달리 타입을 좁힌(narrow) 상태로 유지합니다.

### 8.1 기존 방식의 문제

```typescript
// 문제 1: 타입 주석을 사용하면 리터럴 타입을 잃음
const route: { path: string; method: string } = {
  path: '/api/v1/tenants',
  method: 'GET',
};
// route.path는 string 타입 — 'GET' | 'POST' | 'PUT' | 'DELETE'로 좁혀지지 않음

// 문제 2: as const는 너무 엄격함
const config = {
  retries: 3,
  timeout: 5000,
} as const;
// config.retries는 3 (리터럴 타입) — number 타입이 필요한 곳에 사용 불편
```

### 8.2 satisfies 해결책

```typescript
// satisfies: 타입 검사는 하되, 추론된 타입은 유지
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface Route {
  path: string;
  method: HttpMethod;
  requiresAuth: boolean;
}

// satisfies를 사용하면:
// 1. Route 인터페이스 준수 여부를 컴파일 타임에 검사
// 2. 동시에 각 프로퍼티의 리터럴 타입을 유지
const apiRoutes = {
  listTenants: { path: '/api/v1/tenants', method: 'GET', requiresAuth: true },
  createTenant: { path: '/api/v1/tenants', method: 'POST', requiresAuth: true },
  getTenant: { path: '/api/v1/tenants/:id', method: 'GET', requiresAuth: true },
} satisfies Record<string, Route>;

// 장점: apiRoutes.listTenants.method는 'GET' (리터럴 타입) — Route의 HttpMethod 검사도 통과
const method = apiRoutes.listTenants.method;  // 타입: 'GET'
// Route 타입 주석을 사용했다면 method는 HttpMethod 타입

// 잘못된 method는 컴파일 에러
const badRoutes = {
  badRoute: { path: '/api', method: 'INVALID', requiresAuth: false },
  // 오류: 'INVALID'는 HttpMethod에 할당 불가
} satisfies Record<string, Route>;
```

### 8.3 공공기관 SaaS 실용 예시

```typescript
// CSAP 등급별 접근 정책 정의
type CsapGrade = 'public' | 'internal' | 'confidential' | 'secret';
type AccessLevel = 'read' | 'write' | 'delete' | 'admin';

interface ResourcePolicy {
  requiredGrade: CsapGrade;
  allowedRoles: string[];
  auditRequired: boolean;
  encryptionRequired: boolean;
}

// satisfies로 정책 정의 — 타입 안전 + 리터럴 타입 유지
const resourcePolicies = {
  publicDocs: {
    requiredGrade: 'public',
    allowedRoles: ['user', 'admin'],
    auditRequired: false,
    encryptionRequired: false,
  },
  tenantData: {
    requiredGrade: 'confidential',
    allowedRoles: ['admin', 'tenant-admin'],
    auditRequired: true,            // 리터럴 true 유지
    encryptionRequired: true,
  },
  auditLogs: {
    requiredGrade: 'secret',
    allowedRoles: ['super-admin'],
    auditRequired: true,
    encryptionRequired: true,
  },
} satisfies Record<string, ResourcePolicy>;

// auditRequired가 true인 리소스만 필터링 (리터럴 타입 유지로 가능)
const auditResources = Object.entries(resourcePolicies)
  .filter(([, policy]) => policy.auditRequired)
  .map(([name]) => name);
```

---

## 9. 타입 안전 이벤트 버스 패턴

이벤트 이름을 문자열이 아닌 타입으로 관리하여 이벤트 발행/구독 시 컴파일 타임 안전성을 확보합니다.

### 9.1 이벤트 맵 정의

```typescript
// 이벤트 이름 → 페이로드 타입 매핑
interface EventMap {
  // 사용자 이벤트
  'user:created': {
    userId: UserId;
    tenantId: TenantId;
    email: string;
    timestamp: string;
  };
  'user:deleted': {
    userId: UserId;
    tenantId: TenantId;
    deletedAt: string;
    deletedBy: UserId;
  };
  // 테넌트 이벤트
  'tenant:suspended': {
    tenantId: TenantId;
    reason: string;
    suspendedAt: string;
  };
  // SLO 이벤트
  'slo:violated': {
    service: string;
    sloName: string;
    budgetBurnRate: number;
    level: EscalationLevel;
  };
  // 피처 플래그 이벤트
  'feature-flag:changed': FlagChangeEvent;
  // AI 요청 이벤트
  'ai:request': {
    tenantId: TenantId;
    model: string;
    tokensUsed: number;
    cost: number;
  };
}
```

### 9.2 타입 안전 EventBus 구현

```typescript
type EventKey = keyof EventMap;
type EventCallback<K extends EventKey> = (payload: EventMap[K]) => void | Promise<void>;

class TypedEventBus {
  private listeners = new Map<EventKey, Set<EventCallback<EventKey>>>();

  // 구독: 이벤트 이름에 따라 콜백 타입이 자동으로 결정됨
  on<K extends EventKey>(event: K, callback: EventCallback<K>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as EventCallback<EventKey>);

    // 구독 해제 함수 반환
    return () => this.off(event, callback);
  }

  // 일회성 구독
  once<K extends EventKey>(event: K, callback: EventCallback<K>): void {
    const wrapper = (payload: EventMap[K]) => {
      callback(payload);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  // 발행: 이벤트 이름에 맞는 페이로드만 허용
  async emit<K extends EventKey>(event: K, payload: EventMap[K]): Promise<void> {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;

    const promises = Array.from(callbacks).map(cb =>
      Promise.resolve(cb(payload))
    );
    await Promise.allSettled(promises);
  }

  // 구독 해제
  off<K extends EventKey>(event: K, callback: EventCallback<K>): void {
    this.listeners.get(event)?.delete(callback as EventCallback<EventKey>);
  }
}

// 전역 이벤트 버스 인스턴스
export const eventBus = new TypedEventBus();

// 사용 예시
eventBus.on('slo:violated', (payload) => {
  // payload는 { service: string; sloName: string; budgetBurnRate: number; level: EscalationLevel }
  // 자동 완성 지원, 타입 에러 시 컴파일 오류
  console.log(`SLO 위반: ${payload.service} - ${payload.sloName}`);
});

// 잘못된 페이로드는 컴파일 에러
eventBus.emit('slo:violated', {
  service: 'payment-service',
  sloName: 'availability-99.9',
  budgetBurnRate: 105,
  level: EscalationLevel.Violated,
  // invalidField: 'test',  // 컴파일 에러: EventMap['slo:violated']에 없는 필드
});
```

### 9.3 이벤트 필터링 패턴

```typescript
// 특정 조건의 이벤트만 처리하는 필터 유틸리티
function createFilteredSubscription<K extends EventKey>(
  bus: TypedEventBus,
  event: K,
  filter: (payload: EventMap[K]) => boolean,
  handler: EventCallback<K>
): () => void {
  return bus.on(event, (payload) => {
    if (filter(payload)) {
      handler(payload);
    }
  });
}

// AI 비용이 특정 임계값 이상인 경우만 알림
const unsubscribe = createFilteredSubscription(
  eventBus,
  'ai:request',
  (payload) => payload.cost > 10.0,  // 요청당 10원 초과 시
  async (payload) => {
    await alertManager.send({
      severity: 'warning',
      message: `AI 비용 초과: 테넌트 ${payload.tenantId}, ${payload.cost}원`,
    });
  }
);

// 나중에 구독 해제
unsubscribe();
```

---

## 10. 타입 에러 디버깅 10가지

TypeScript를 사용하다 자주 마주치는 에러와 해결 방법을 정리합니다.

### 에러 1: "Type instantiation is excessively deep and possibly infinite"

```typescript
// 원인: 재귀 타입이 너무 깊게 중첩됨
type Infinite<T> = T extends object ? { [K in keyof T]: Infinite<T[K]> } : T;
// 이 자체는 괜찮지만, 복잡한 객체에 적용하면 문제 발생

// 해결: 재귀 깊이 제한 추가
type DeepPartial<T, Depth extends number = 5> =
  Depth extends 0
    ? T
    : T extends object
    ? { [P in keyof T]?: DeepPartial<T[P], [-1, 0, 1, 2, 3, 4][Depth]> }
    : T;
```

### 에러 2: "Cannot use 'X' as a value because it only refers to a type"

```typescript
// 원인: 타입은 런타임에 존재하지 않음
if (x instanceof MyInterface) { ... }  // 오류! 인터페이스는 런타임에 없음

// 해결 1: 타입 가드 함수 사용
function isMyInterface(x: unknown): x is MyInterface {
  return typeof x === 'object' && x !== null && 'requiredProp' in x;
}

// 해결 2: enum 사용 (런타임에 존재)
enum Status { Active = 'active', Inactive = 'inactive' }
if (x === Status.Active) { ... }  // OK
```

### 에러 3: "Object is possibly 'undefined'" (strictNullChecks)

```typescript
// 원인: 값이 undefined일 수 있는데 바로 사용
const user = users.find(u => u.id === id);
console.log(user.name);  // 오류! user가 undefined일 수 있음

// 해결 1: 옵셔널 체이닝
console.log(user?.name);

// 해결 2: 널 어서션 (확실할 때만)
const user = users.find(u => u.id === id)!;  // undefined 아님을 단언

// 해결 3: 타입 가드
if (user !== undefined) {
  console.log(user.name);  // 이 블록에서는 user가 User 타입
}

// 해결 4: Zod safeParse 결과 처리
const result = UserSchema.safeParse(rawData);
if (result.success) {
  console.log(result.data.name);  // success가 true면 data는 반드시 존재
}
```

### 에러 4: "Argument of type 'string' is not assignable to parameter of type 'never'"

```typescript
// 원인: switch/if-else에서 타입이 never로 좁혀짐
function process(action: 'create' | 'update') {
  if (action === 'create') {
    // ...
  } else if (action === 'update') {
    // ...
  } else {
    // 여기서 action은 never 타입
    action.someMethod();  // 오류!
  }
}

// 해결: exhaustive check 패턴
function assertNever(x: never): never {
  throw new Error(`처리되지 않은 케이스: ${x}`);
}

function process(action: 'create' | 'update') {
  switch (action) {
    case 'create': return handleCreate();
    case 'update': return handleUpdate();
    default: return assertNever(action);  // 컴파일러가 모든 케이스를 강제
  }
}
```

### 에러 5: "Property 'X' does not exist on type 'never'"

```typescript
// 원인: 잘못된 타입 좁히기로 never가 됨
type A = { type: 'a'; aData: string };
type B = { type: 'b'; bData: number };
type AB = A | B;

function process(item: AB) {
  if (item.type === 'a' && item.type === 'b') {
    // 동시에 'a'이고 'b'일 수 없으므로 never
    item.aData;  // 오류!
  }
}

// 해결: 타입 가드 조건 수정
function process(item: AB) {
  if (item.type === 'a') {
    item.aData;  // OK, item은 A 타입
  } else {
    item.bData;  // OK, item은 B 타입
  }
}
```

### 에러 6: "Type 'X | undefined' is not assignable to type 'X'"

```typescript
// 원인: undefined가 포함된 타입을 undefined가 없는 타입에 할당
function getConfig(): Config | undefined { ... }

const config: Config = getConfig();  // 오류!

// 해결 1: null 병합 연산자로 기본값 제공
const config: Config = getConfig() ?? defaultConfig;

// 해결 2: 타입 단언 (undefined가 불가능함을 확신할 때)
const config = getConfig() as Config;

// 해결 3: 에러 발생 (항상 값이 있어야 하는 경우)
const config = getConfig();
if (!config) throw new Error('Config is required');
```

### 에러 7: "Overload signatures must all be optional or required"

```typescript
// 오류 있는 오버로드
function fetch(url: string): Promise<Response>;
function fetch(url: string, options: RequestInit): Promise<Response>;
function fetch(url: string, options?: RequestInit): Promise<Response> {
  // 구현
}

// 해결: 구현 시그니처의 파라미터를 모든 오버로드와 호환되게 설정
function createUser(name: string): User;
function createUser(name: string, email: string): User;
function createUser(name: string, email?: string): User {
  return { name, email: email ?? '' };
}
```

### 에러 8: "Index signature parameter type must be 'string' or 'number'"

```typescript
// 오류: union 타입을 인덱스 시그니처 키로 사용
type Config = {
  [key: 'a' | 'b' | 'c']: string;  // 오류!
};

// 해결 1: Record 사용
type Config = Record<'a' | 'b' | 'c', string>;

// 해결 2: Mapped Type 사용
type Keys = 'a' | 'b' | 'c';
type Config = {
  [K in Keys]: string;
};
```

### 에러 9: "Type 'readonly X[]' is not assignable to type 'X[]'"

```typescript
// 원인: readonly 배열을 mutable 배열 자리에 사용
const readonlyArr = ['a', 'b', 'c'] as const;
function process(arr: string[]) { ... }

process(readonlyArr);  // 오류!

// 해결 1: 함수 파라미터를 readonly로 변경
function process(arr: readonly string[]) { ... }

// 해결 2: 스프레드로 복사
process([...readonlyArr]);

// 해결 3: as 캐스팅 (readonly 보장이 깨지므로 주의)
process(readonlyArr as string[]);
```

### 에러 10: "This condition will always return 'true' since the types have no overlap"

```typescript
// 원인: 항상 참인 조건 체크 (TypeScript가 정적으로 판단)
type Status = 'active' | 'inactive';
const status: Status = 'active';

if (status === 'pending') {  // 오류! 'Status'는 'pending'이 될 수 없음
  // ...
}

// 해결: 타입 정의에 'pending' 추가 또는 조건 제거
type Status = 'active' | 'inactive' | 'pending';  // 값 추가

// 또는 조건이 불필요함을 확인하고 제거
const isActive = status === 'active';  // OK
```

---

## 11. tsconfig 최적화

### 11.1 공공기관 SaaS 권장 tsconfig.json

```json
{
  "compilerOptions": {
    // === 엄격 모드 ===
    "strict": true,                    // 모든 strict 플래그 활성화
    "noUncheckedIndexedAccess": true,  // arr[0]가 T | undefined 타입
    "exactOptionalPropertyTypes": true, // optional과 undefined를 구분
    "noImplicitReturns": true,         // 모든 코드 경로에서 반환값 필수
    "noFallthroughCasesInSwitch": true, // switch case 누락 방지
    "noPropertyAccessFromIndexSignature": true, // 인덱스 시그니처 접근 방식 통일

    // === 모듈 설정 ===
    "module": "ESNext",
    "moduleResolution": "Bundler",     // Vite/esbuild용 (Node16 대신)
    "target": "ES2022",
    "lib": ["ES2022", "DOM"],

    // === 경로 별칭 (모노레포 내비게이션) ===
    "baseUrl": ".",
    "paths": {
      "@platform/*": ["../../platform/packages/*/src"],
      "@packages/*": ["../../packages/*/src"],
      "@/*": ["./src/*"]
    },

    // === 출력 설정 ===
    "outDir": "./dist",
    "declaration": true,             // .d.ts 파일 생성 (패키지 공유용)
    "declarationMap": true,          // 선언 파일 소스맵
    "sourceMap": true,

    // === 기타 ===
    "skipLibCheck": true,            // node_modules 타입 체크 스킵 (빌드 속도)
    "resolveJsonModule": true,       // JSON import 허용
    "esModuleInterop": true,         // CommonJS 모듈 호환성
    "forceConsistentCasingInFileNames": true  // 파일명 대소문자 일관성
  }
}
```

### 11.2 strict 플래그별 효과

| 플래그 | 효과 | CSAP 연관 |
|--------|------|-----------|
| `strictNullChecks` | null/undefined 별도 처리 필수 | D-12 입력 검증 |
| `strictFunctionTypes` | 함수 파라미터 반공변성 강제 | 코드 정확성 |
| `strictBindCallApply` | bind/call/apply 타입 안전 | 코드 정확성 |
| `strictPropertyInitialization` | 클래스 프로퍼티 초기화 강제 | 런타임 에러 방지 |
| `noImplicitAny` | any 타입 암묵적 사용 금지 | 코드 가독성 |
| `noImplicitThis` | this 타입 명시 필수 | 코드 정확성 |
| `useUnknownInCatchVariables` | catch 변수가 unknown 타입 | 에러 처리 안전성 |

### 11.3 경로 별칭 설정

모노레포에서 `../../packages/feature-flag-sdk/src` 같은 긴 경로 대신 `@packages/feature-flag-sdk`를 사용합니다.

```json
// tsconfig.json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@packages/feature-flag-sdk": ["../../packages/feature-flag-sdk/src/index.ts"],
      "@packages/slo-escalation": ["../../packages/slo-escalation/src/index.ts"],
      "@platform/mesh-ready": ["../../platform/packages/mesh-ready/src/index.ts"]
    }
  }
}
```

```typescript
// 사용 예시 — 긴 경로 대신 별칭 사용
import { createFeatureFlagClient } from '@packages/feature-flag-sdk';
import { SLOEscalationController } from '@packages/slo-escalation';
import { GracefulShutdown } from '@platform/mesh-ready';
```

---

## 12. TypeScript 성능 최적화

타입 체크 시간이 길어지면 개발 생산성이 떨어집니다. 다음 플로우차트와 기법으로 최적화합니다.

```mermaid
flowchart TD
    A[타입 체크 느림 감지<br/>tsc --diagnostics 실행] --> B{병목 원인 분석}

    B --> C[복잡한 조건부 타입]
    B --> D[대용량 union 타입]
    B --> E[깊은 재귀 타입]
    B --> F[과도한 infer 사용]
    B --> G[node_modules 포함]

    C --> C1[인터페이스로 단순화<br/>type → interface 변환]
    C --> C2[타입 별칭 중간 변수 도입<br/>단계별 분리]

    D --> D1[Mapped Type으로 대체<br/>긴 union을 Record로]
    D --> D2[const enum 활용<br/>런타임 코드 제거]

    E --> E1[재귀 깊이 제한<br/>Depth extends number]
    E --> E2[lazy evaluation 도입<br/>() => Type 패턴]

    F --> F1[헬퍼 타입 추출<br/>재사용 가능한 단위로]
    F --> F2[Built-in 유틸리티 활용<br/>ReturnType, Awaited]

    G --> G1[skipLibCheck: true<br/>선언 파일 체크 스킵]
    G --> G2[include/exclude 최적화<br/>불필요한 파일 제외]

    C1 & C2 & D1 & D2 & E1 & E2 & F1 & F2 & G1 & G2 --> H[성능 재측정]

    H --> I{개선 확인}
    I -->|개선됨| J[완료]
    I -->|여전히 느림| K[ts-plugin-performance 프로파일링]
    K --> L[TypeScript 4.9+ 증분 빌드<br/>tsBuildInfoFile 설정]
    L --> J

    style A fill:#FF6B6B,color:#fff
    style J fill:#96CEB4,color:#fff
    style K fill:#FFEAA7,color:#333
```

### 12.1 타입 체크 시간 측정

```bash
# 타입 체크 시간 측정
npx tsc --noEmit --diagnostics 2>&1 | grep -E "Files|Lines|Symbols|Types|Instantiations|Time"

# 느린 파일 찾기 (TypeScript Language Server)
# VS Code: cmd+shift+p → "TypeScript: Restart TS Server" → 개발자 도구 → 콘솔 확인

# 성능 추적
npx tsc --generateTrace ./ts-trace
npx @typescript/analyze-trace ./ts-trace
```

### 12.2 인터페이스 vs 타입 별칭

```typescript
// 성능 관점: interface가 더 빠름
// 이유: interface는 이름을 가지므로 내부적으로 캐싱됨

// 느림: 타입 별칭 (매번 확장 시 재계산)
type UserType = {
  id: string;
  name: string;
};
type AdminType = UserType & { permissions: string[] };

// 빠름: 인터페이스 (구조적 캐싱)
interface User {
  id: string;
  name: string;
}
interface Admin extends User {
  permissions: string[];
}
```

### 12.3 증분 빌드 설정

```json
// tsconfig.json — 증분 빌드로 재빌드 속도 향상
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": "./.tsbuildinfo",  // 캐시 파일 위치
    "composite": true                      // 프로젝트 참조용
  }
}
```

### 12.4 프로젝트 참조로 모노레포 최적화

```json
// 루트 tsconfig.json
{
  "references": [
    { "path": "./packages/feature-flag-sdk" },
    { "path": "./packages/slo-escalation" },
    { "path": "./packages/ml-pipeline" },
    { "path": "./platform/services/ai-service" }
  ]
}

// 각 패키지 tsconfig.json
{
  "compilerOptions": {
    "composite": true,    // 프로젝트 참조 필수 설정
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

```bash
# 모노레포 전체 빌드 — 변경된 패키지만 재빌드
npx tsc --build

# 특정 패키지부터 빌드
npx tsc --build packages/feature-flag-sdk

# 빌드 캐시 초기화
npx tsc --build --clean
```

### 12.5 공통 성능 안티패턴

```typescript
// 1. 과도한 조건부 타입 중첩 (느림)
type Slow<T> = T extends string
  ? T extends `${string}Id`
    ? T extends `user${string}` ? 'userId' : 'otherId'
    : never
  : never;

// 개선: 단계별 분리
type IsStringType<T> = T extends string ? true : false;
type IsIdFormat<T extends string> = T extends `${string}Id` ? true : false;
type IdCategory<T extends string> =
  T extends `user${string}` ? 'userId' : 'otherId';

// 2. 거대한 Union 타입 (느림)
type LargeUnion = 'aaa' | 'aab' | 'aac' | /* ... 수백 개 */ | 'zzz';

// 개선: 프로그래밍적으로 생성
type Letter = 'a' | 'b' | /* ... */ | 'z';
type TwoLetters = `${Letter}${Letter}`;  // 676개 자동 생성 (빠름)
```

---

## 마무리: 공공기관 SaaS TypeScript 체크리스트

구현 전 다음 항목을 확인하세요:

- [ ] 모든 외부 입력에 Zod 스키마 검증 적용 (CSAP D-12)
- [ ] ID 타입에 Branded Type 사용 (UserId, TenantId, TraceId)
- [ ] API 계약에 인터페이스 정의 (IFeatureFlagClient 패턴)
- [ ] enum이 있는 곳에 Record 매핑으로 완전성 검사
- [ ] strict 모드 활성화 확인
- [ ] 재귀 타입에 깊이 제한 추가
- [ ] `as any` 사용 시 // FIXME 주석 필수
- [ ] 에러 처리에서 `unknown` 타입 사용 (never any)
- [ ] `satisfies` 연산자로 리터럴 타입 유지
- [ ] tsconfig `paths` 설정으로 import 경로 정리

---

*이 문서는 실제 프로젝트 코드를 분석하여 작성되었습니다.*
*참조 파일: `packages/feature-flag-sdk/src/index.ts`, `packages/slo-escalation/src/escalation-controller.ts`, `packages/ml-pipeline/src/model-ci.ts`*
