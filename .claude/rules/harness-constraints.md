---
description: 프로젝트 하네스 제약 규칙. 모든 파일에 적용. ECC common/coding-style + common/git-workflow 기반.
globs: ["**/*"]
---

# 하네스 제약 규칙 (Harness Constraints)

> ECC v1.9.0 common/coding-style + common/git-workflow 기반
> 공공기관 SaaS 프레임워크 + 행안부 감리기준 최적화

## 1. 코딩 스타일 (ECC common/coding-style)

- **들여쓰기**: 2칸 (TypeScript/JavaScript), 4칸 (Python)
- **변수·함수명**: 스스로 설명하는 명확한 이름 (약어 금지)
- **함수 크기**: 80줄 이하, 단일 책임 원칙
- **파일 크기**: 800줄 이하 (초과 시 분리 검토)
- **줄 길이**: 120자 이하
- **주석**: 무엇이 아닌 왜를 설명 (자명한 코드에 주석 금지)
- **중첩 깊이**: 4단계 이하

## 2. Dead Code 정책 (ECC refactor-cleaner)

- **미사용 함수·변수**: 발견 즉시 제거 또는 사유 주석 필수
  ```
  // NOTE: 미사용. 이유: Phase 2 구현 시 사용 예정 (FR-2.3)
  ```
- **주석 처리된 코드**: 제거 (git 히스토리로 복구 가능)
- **오래된 TODO**: 3개월 초과 시 이슈 전환 후 제거
- **주간 자동 탐지**: `npm run audit:dead-code` (vulture + ts-prune)

## 3. 문서-코드 추적성

- **API 목록 동기화**: `docs/` API 명세 ↔ `src/` 구현 1:1 매핑
- **구현 전 문서**: 구현 시작 전 Plan + Design 문서 완비 필수
- **변경 후 CHANGELOG**: 모든 기능 변경은 `CHANGELOG.md` 업데이트

## 4. Git 워크플로우 (ECC common/git-workflow)

- **브랜치 전략**: `feat/`, `fix/`, `docs/`, `refactor/` 접두사
- **커밋 메시지**: Conventional Commits 형식 필수
  ```
  feat(csap): FR-2.1 표준등급 79항목 체크리스트 추가
  fix(n2sf): N-03 격리 영역 C등급 요건 오류 수정
  docs(audit): T01 사업계획서 템플릿 감리기준 조항 추가
  refactor(infra): k3s 레시피 중복 명령 제거 (dead code)
  ```
- **커밋 전**: 테스트 통과 + 린트 오류 없음 확인
- **`--no-verify` 금지**: git 훅 우회 절대 금지 (ECC block-no-verify)
- **`--force` 금지**: 강제 푸시 절대 금지 (감사 추적 파괴)

## 5. 반복 탐색 패턴 (ECC 3라운드 원칙)

- 1라운드: 광범위 탐색 (Glob, Grep 활용)
- 2라운드: 특정 영역 심화 (파일 읽기)
- 3라운드: 최종 검증
- **3라운드 초과 불허** — 반복 탐색은 설계 문제 신호

## 6. 에이전트 호출 원칙

- 에이전트 간 결과물은 **파일로 전달** (직접 컨텍스트 공유 아님)
- Cascade 순서 준수: 구현 → 리뷰 → 감리 → 테스트 → 리팩토링
- 에이전트 건너뛰기 금지 (모든 게이트 통과 필수)
