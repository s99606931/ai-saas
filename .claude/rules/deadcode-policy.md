---
description: Dead code 제거 정책. 소스 코드 파일에 적용. ECC refactor-cleaner 패턴 기반.
globs: ["src/**/*.{ts,tsx,js,py}", "scripts/**/*.{sh,py}"]
---

# Dead Code 제거 정책

> ECC `refactor-cleaner` + `stop:evaluate-session` 패턴 기반
> **목표: Dead code 0개** — Phase 완료 시 + 주간 자동 실행

## 탐지 도구

```bash
# TypeScript/JavaScript
npx ts-prune --error                    # 미사용 export 탐지
npx depcheck                            # 미사용 npm 패키지

# Python
python -m pyflakes src/                 # 미사용 import, 변수
python -m vulture src/ --min-confidence 80  # 미사용 함수

# 일괄 실행
npm run audit:dead-code
```

## 처리 기준

| 코드 유형 | 처리 방법 | 기한 |
|---------|---------|------|
| 미사용 함수 | 즉시 제거 | 발견 즉시 |
| 미사용 변수 | 즉시 제거 | 발견 즉시 |
| 미사용 import | 즉시 제거 | 발견 즉시 |
| 미사용 CSS 클래스 | 즉시 제거 | 발견 즉시 |
| 주석 처리된 코드 | 제거 (git 히스토리 보존) | 발견 즉시 |
| 오래된 TODO (3개월+) | GitHub 이슈 전환 후 제거 | 1주일 이내 |
| 미사용 npm 패키지 | package.json에서 제거 | 발견 즉시 |

## 예외 목록 (제거 금지)

```typescript
// ✅ 예외 1: 공개 API (deprecation 정책 적용 중)
/**
 * @deprecated v2.0에서 제거 예정. v1.x 호환성 유지.
 * @see newFunction
 */
export function oldPublicApi() { ... }

// ✅ 예외 2: 미래 Phase 사용 예정 (명시적 주석 필수)
// NOTE: 미사용. Phase 2 FR-2.3 구현 시 사용 예정. 2026-07-01 이후 재검토.
function csapStandardGradeValidator() { ... }

// ✅ 예외 3: 테스트 fixture
export const mockCsapChecklist = { ... }  // tests/fixtures/

// ✅ 예외 4: 마이그레이션 스크립트
export async function migrateToV2() { ... }  // migrations/
```

## 자동화 스케줄

```bash
# 주간 자동 실행 (Claude Code /loop)
/loop 7d npm run audit:dead-code

# Phase 완료 시 Refactorer 에이전트 자동 실행
# (Tester 완료 후 자동 호출됨)
```

## CHANGELOG 기록 필수

리팩토링 완료 시 반드시 `CHANGELOG.md` 업데이트:

```markdown
## [Unreleased]
### Removed (Dead Code)
- `src/utils/oldHelper.ts`: 미사용 함수 3개 제거 (Phase 1 완료)
- `src/components/UnusedWidget.tsx`: Phase 3 연기로 제거
### Refactored
- `src/api/csap.ts`: 80줄 → 45줄 (단일 책임 분리)
```

## 위반 시 처리

Dead code가 발견되었음에도 처리되지 않은 경우:
1. Reviewer 에이전트가 HIGH 심각도로 플래그
2. Q-GATE G3 불통과
3. Implementer가 정리 후 재검토 요청
