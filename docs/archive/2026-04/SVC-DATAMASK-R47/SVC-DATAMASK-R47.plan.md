# SVC-DATAMASK-R47 Plan — N2SF 데이터 등급 마스킹 엔진

| 항목 | 값 |
|------|-----|
| MTU | SVC-DATAMASK-R47 |
| 대상 | `platform/packages/data-mask` |
| 복잡도 | MED |
| 작성일 | 2026-04-11 |

---

## Executive Summary

| 관점 | 현황 | 목표 |
|------|------|------|
| 기능 | DataGrade 타입만 존재, 마스킹 엔진 부재 | 6종 PII + 키 기반 + 정규식 + 객체 트리 마스킹 |
| 품질 | 각 서비스 ad-hoc 마스킹 | 통합 패키지 + 25개 이상 테스트 |
| 보안 | C/S등급 데이터 AI API 전송 위험 | enforceGrade 가드로 강제 차단 (CLAUDE.md §1) |
| 운영 | 마스킹 정책 분산 | 정책 객체 + 감사 로그 훅 |

---

## Context Anchor

- **WHY**: CLAUDE.md 절대 제약: `AI API 호출 시 N2SF C/S 등급 데이터 전송 절대 금지. PII는 마스킹 필수.` AI 게이트웨이 호출 전 모든 페이로드는 이 패키지를 통과해야 함.
- **WHO**: ai-service, ai-gateway, RAG 파이프라인.
- **RISK**: 마스킹 누락 → 개인정보 유출 → CSAP 인증 박탈. 과도 마스킹 → AI 응답 품질 저하.
- **SUCCESS**: (1) 6종 PII 자동 탐지·마스킹, (2) C/S 등급 데이터 차단, (3) 키 기반 정책 적용, (4) 마스킹 결과 감사 가능.
- **SCOPE**: 한국 PII 6종 (주민번호, 전화, 이메일, 카드, 계좌, 주소). DataGrade enforce. 객체/배열 트리 순회. 외부 NER 모델 미포함.

---

## FR

| ID | 요구사항 | 수용 기준 |
|----|----------|----------|
| FR-DM.1 | 주민등록번호 패턴 탐지·마스킹 (`123456-1******`) | 정상 + 잘못된 포맷 검증 |
| FR-DM.2 | 전화번호 (휴대폰/유선) 마스킹 | 010-1234-5678 → 010-****-5678 |
| FR-DM.3 | 이메일 마스킹 (로컬파트 절반) | a***@example.com |
| FR-DM.4 | 신용카드 (Luhn 검증 후) 마스킹 | 첫 6 + 마지막 4 보존 |
| FR-DM.5 | 한국 은행 계좌번호 마스킹 | 마지막 4자리만 보존 |
| FR-DM.6 | 한국 주소 마스킹 (시도/시군구만 보존) | "서울특별시 강남구 ****" |
| FR-DM.7 | 객체/배열 깊이 우선 트리 마스킹 (재귀) | 중첩 5단계 검증 |
| FR-DM.8 | 키 기반 정책 (예: `password`, `ssn` 키는 항상 `[MASKED]`) | 키 매칭 규칙 |
| FR-DM.9 | `enforceGrade(data, allowed)`: 등급이 allowed에 없으면 예외 | C 등급은 예외 발생 |
| FR-DM.10 | 마스킹 통계 (감사 훅: 각 PII 종류별 카운트) | onMask 콜백 |

---

## Q-Gate

- G1: 10/10 FR
- G2: Design 모듈 + 알고리즘 + 우선순위 명시
- G3: typecheck strict
- G4: 25개 이상 테스트
- G5: false positive 최소화 (한글 일반문자 보존)
- G6: CSAP D-09 암호화/마스킹, N2SF 6 영역 준수
- G7: audit.jsonl
