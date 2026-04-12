# MTU-N80: S2C2F 공급망 소비 프레임워크 — Plan

> **MTU ID**: MTU-N80
> **Phase**: 6라운드 CI/CD·DevOps 고도화
> **작성일**: 2026-04-10
> **상태**: Plan 완료

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | Microsoft S2C2F 프레임워크 적용으로 OSS 공급망 보안 성숙도 Level 3 달성 |
| 기술 | OpenSSF S2C2F 8대 실천항목 + Kyverno 정책 자동 검증 |
| 보안 | CSAP D-12 + SLSA L3 연계, 의존성 소비 안전성 보장 |
| 운영 | 자동화된 의존성 검증 파이프라인 + 감사 추적 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | OSS 의존성 통한 공급망 공격 증가, 체계적 소비 프레임워크 필요 |
| WHO | DevSecOps 팀, 보안 감사 담당자 |
| RISK | 과도한 정책이 개발 속도 저하 → 단계적 성숙도 적용 |
| SUCCESS | S2C2F Level 3 성숙도 달성, 8대 실천항목 자동 검증 |
| SCOPE | S2C2F 정책 문서, Kyverno 정책, CI 파이프라인 통합, 감사 스크립트 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N80.1 | S2C2F 8대 실천항목 정책 문서 작성 | HIGH |
| FR-N80.2 | 의존성 인벤토리 자동 생성 (SBOM 연계) | HIGH |
| FR-N80.3 | 의존성 출처 검증 Kyverno 정책 | HIGH |
| FR-N80.4 | 취약점 자동 스캔 + 차단 정책 | HIGH |
| FR-N80.5 | 의존성 핀닝(pinning) 검증 | MED |
| FR-N80.6 | OSS 라이선스 호환성 검사 | MED |
| FR-N80.7 | S2C2F 성숙도 평가 스크립트 | HIGH |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | S2C2F 정책 문서 | infra/security/s2c2f/policy.yaml |
| 2 | Kyverno 의존성 검증 정책 | infra/security/s2c2f/kyverno-policies.yaml |
| 3 | 라이선스 검사 설정 | infra/security/s2c2f/license-check.yaml |
| 4 | 성숙도 평가 스크립트 | scripts/s2c2f-assessment.sh |
| 5 | E2E 테스트 | tests/e2e/test-s2c2f.sh |
