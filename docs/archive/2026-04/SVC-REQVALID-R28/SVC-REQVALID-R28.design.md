# SVC-REQVALID-R28 DESIGN: Request Validator 라이브러리

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/SVC-REQVALID-R28.plan.md

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead |

---

## 검증 흐름

```
요청 수신
  -> body/query/params 스키마 검증 (Zod)
  -> HTML 새니타이제이션 (문자열 필드)
  -> 성공: 타입 안전 데이터 반환 (z.infer)
  -> 실패: RFC 7807 Problem Details 에러 반환
```

---

## 주요 인터페이스

```typescript
interface ValidationSchema<B, Q, P> {
  body?: ZodSchema<B>;
  query?: ZodSchema<Q>;
  params?: ZodSchema<P>;
}

interface ValidationResult<B, Q, P> {
  success: true;
  data: { body: B; query: Q; params: P };
}

interface ValidationError {
  success: false;
  error: ProblemDetails;
}

// RFC 7807
interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  errors: FieldError[];
}

interface FieldError {
  field: string;
  message: string;
  code: string;
}
```

---

## HTML 새니타이제이션

문자열 필드에 대한 기본 새니타이제이션 (외부 라이브러리 미사용, 경량 구현):

```
< → &lt;
> → &gt;
" → &quot;
' → &#x27;
& → &amp;  (이미 이스케이프된 경우 제외)
```

---

## Session Guide

### 구현 순서
1. `src/request-validator.ts` -- 코어 검증 로직
2. `src/index.ts` -- 패키지 엔트리포인트
3. `tests/request-validator.test.ts` -- 단위 테스트

### Design Anchor
- 모든 구현 파일 상단: `// Design Ref: SVC-REQVALID-R28 DESIGN`
- 모든 함수: `// Plan SC: FR-RV.{번호}`
