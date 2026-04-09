# Report: MTU-N31 Kyverno Enforce 전환

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N31 |
| 완료일 | 2026-04-08 |
| matchRate | 100% (5/5 FR) |
| 복잡도 | MED |

## Executive Summary

| 관점 | 목표 | 달성 |
|------|------|------|
| 비즈니스 | 미서명 이미지 차단 | Enforce 모드 적용 완료 |
| 기술 | Kyverno v1.17.1 설치 | Helm 설치 성공, 2 Pods Running |
| 보안 | CSAP D-05-03 준수 | 미서명 이미지 차단 검증 완료 |
| 운영 | 기존 서비스 무중단 | 58 Pods Running 유지 |

## FR별 달성 현황

| FR ID | 요구사항 | 상태 | 증적 |
|-------|---------|------|------|
| FR-N31.1 | Kyverno Helm Chart 설치 | PASS | kyverno NS 2 Pods Running |
| FR-N31.2 | Enforce 모드 적용 | PASS | validationFailureAction: Enforce |
| FR-N31.3 | 미서명 이미지 차단 | PASS | localhost:8080/public-saas/unsigned-test 거부 확인 |
| FR-N31.4 | 기존 서비스 안정 | PASS | 58 Running Pods 유지 |
| FR-N31.5 | 가이드 문서 | PASS | docs/07-infra/kyverno-enforce-guide.md |

## 주요 결정 사항

1. **Kyverno Chart v3.7.1 선택**: 최신 안정 버전 (v1.17.1 엔진)
2. **WSL2 최소 설치**: reportsController, cleanupController 비활성화
3. **mutateDigest: false 설정**: v1.17.1에서 Audit/Enforce 모드 호환성 필수
4. **Gradual Rollout**: Audit -> Enforce 단계적 전환 (Kyverno 권장 방식)

## 산출물

- infra/kyverno/verify-image-signature.yaml (Enforce 모드)
- infra/kyverno/values.yaml (Helm 설정)
- docs/07-infra/kyverno-enforce-guide.md

## CSAP 매핑

| CSAP | 항목 | 준수 |
|------|------|------|
| D-05-03 | 접근통제 정책 관리 | PASS |
| D-12-08 | 소프트웨어 개발 보안 | PASS |
| D-09-01 | 암호화 통제 | PASS (ECDSA 서명) |
