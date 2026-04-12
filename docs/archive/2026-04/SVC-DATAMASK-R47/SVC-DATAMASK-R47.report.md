# SVC-DATAMASK-R47 Report — N2SF 데이터 마스킹 엔진

| 항목 | 값 |
|------|-----|
| 일자 | 2026-04-11 |
| 상태 | 완료 |
| matchRate | 100% |
| 테스트 | 33/33 |

## Executive Summary

| 관점 | 결과 |
|------|------|
| 기능 | 6종 한국 PII + 키 정책 + 트리 순회 + 등급 가드 |
| 품질 | 33개 테스트, false positive 검증, typecheck strict |
| 보안 | CLAUDE.md §1 절대 제약(C/S등급 차단) 강제, OWASP A02/A04 |
| 운영 | 외부 의존성 0, 감사 훅, 순환 참조 안전 |

## Key Decisions

1. **한국 PII 우선**: 주민번호, 한국 휴대폰/유선, 한국 주소(시·도+시·군·구) 우선 처리.
2. **Luhn 검증**: 카드 패턴은 Luhn 통과 시에만 마스킹 → false positive 최소화.
3. **Sentinel 보호**: Luhn 실패 카드는 sentinel로 일시 치환해 후속 계좌 패턴 간섭 차단.
4. **enforceAiSafe('O')**: AI API 호출 전용 단축 가드 — CLAUDE.md §1 준수 강제.
5. **WeakSet 순환 차단**: 트리 마스킹 시 무한 루프 방지.
6. **훅 격리**: onMask 콜백 예외는 삼켜서 마스킹 자체가 깨지지 않도록 함.

## 산출물

- `platform/packages/data-mask/src/{types,pii-patterns,string-masker,tree-masker,key-policy,enforcer,index}.ts`
- `platform/packages/data-mask/tests/data-mask.test.ts`
- Plan, Design, Analysis, Report
