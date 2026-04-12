# SVC-EVENTSCHEMA-R48 Design — 이벤트 스키마 레지스트리

## 모듈 구조

```
platform/packages/event-schema-registry/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── semver.ts        # parse + compare
│   ├── schema-validator.ts  # JSON Schema subset validator
│   ├── compatibility.ts # backward compat 검사
│   └── registry.ts      # SchemaRegistry 클래스
└── tests/
    └── event-schema-registry.test.ts
```

## 타입

```typescript
export interface EventSchema {
  type: 'object';
  properties?: Record<string, EventSchema | PrimitiveSchema>;
  required?: string[];
  items?: EventSchema | PrimitiveSchema;
  additionalProperties?: boolean;
}

export interface PrimitiveSchema {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array';
  enum?: unknown[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  items?: EventSchema | PrimitiveSchema;
}

export type Schema = EventSchema | PrimitiveSchema;

export interface ValidationError {
  path: string;
  message: string;
}

export class EventSchemaError extends Error {
  errors: ValidationError[];
}

export interface RegistryOptions {
  strict?: boolean;  // true: 미등록 이벤트 거부 (default true)
}
```

## 알고리즘

### semver 비교
```
parse(v): { major, minor, patch }
compare(a, b): -1 | 0 | 1  (major → minor → patch)
```

### 호환성 (backward compatible)
```
isBackwardCompatible(oldSchema, newSchema):
  // major bump → 호환 안 됨 (breaking)
  // minor/patch에서 허용:
  //   - 새 optional 필드 추가 OK
  //   - required 추가 NOT OK
  //   - 기존 필드 type 변경 NOT OK
  //   - required 제거 OK
  //   - enum에 값 추가 OK, 제거 NOT OK
```

### validate
```
validate(schema, value, path=''):
  errors = []
  type 검사
  if object:
    for required field: 누락 시 push
    for each property: 재귀
  if array:
    for each item: 재귀
  if enum: 멤버십 검사
  if string: minLength/maxLength
  if number: minimum/maximum
  return errors
```

## 테스트 계획 (20+)

| # | 케이스 | FR |
|---|--------|----|
| 1 | semver parse 정상 | FR-ESR.2 |
| 2 | semver parse 실패 → 예외 | FR-ESR.2 |
| 3 | semver compare major | FR-ESR.2 |
| 4 | semver compare minor | FR-ESR.2 |
| 5 | semver compare patch | FR-ESR.2 |
| 6 | register 정상 | FR-ESR.1 |
| 7 | register 중복 → 예외 | FR-ESR.1 |
| 8 | latest 조회 (3개 버전 중 최신) | FR-ESR.5 |
| 9 | listEvents 정렬 | FR-ESR.6 |
| 10 | validate 정상 페이로드 | FR-ESR.3 |
| 11 | validate 누락 required → path 포함 | FR-ESR.3, FR-ESR.7 |
| 12 | validate 잘못된 type | FR-ESR.3 |
| 13 | validate 중첩 객체 | FR-ESR.3 |
| 14 | validate 배열 items | FR-ESR.3 |
| 15 | validate enum 위반 | FR-ESR.3 |
| 16 | validate string minLength | FR-ESR.3 |
| 17 | 미등록 이벤트 strict → 거부 | FR-ESR.8 |
| 18 | 미등록 이벤트 lenient → 통과 | FR-ESR.8 |
| 19 | 호환성: required 추가 → false | FR-ESR.4 |
| 20 | 호환성: optional 추가 → true | FR-ESR.4 |
| 21 | 호환성: enum 값 제거 → false | FR-ESR.4 |
| 22 | 호환성: type 변경 → false | FR-ESR.4 |
