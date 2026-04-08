# Plan: MTU-N27 Cosign 이미지 서명 실전 적용

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N27 |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-08 |
| 작성자 | PM Lead (Opus 4.6) |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | CSAP D-12/D-05 공급망 보안 인증 증적 확보 |
| 기술 | Cosign v3.0.6 로컬 키 기반 서명 + Harbor OCI 서명 저장 |
| 보안 | 미서명 이미지 배포 차단 → 공급망 공격 방어 |
| 운영 | CI/CD 자동 서명 → 수동 작업 제거, 폐쇄망 호환 |

---

## Context Anchor

- **WHY**: CSAP D-12/D-05 인증 증적 필수. 실전 서명/검증 경험 확보
- **WHO**: DevOps, 보안 담당자, CSAP 심사 대응팀
- **RISK**: Harbor insecure registry 호환성, Kyverno 정책 기존 Pod 영향
- **SUCCESS**: 5개 FR 전수 통과 (키 생성/서명/검증/정책/자동화)
- **SCOPE**: Cosign 로컬 키 + Harbor 서명 + Kyverno 정책 + CI/CD 자동화

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 기준 |
|-------|---------|---------|---------|
| FR-N27.1 | Cosign 키 쌍 생성 | MUST | cosign.key, cosign.pub 파일 존재 |
| FR-N27.2 | Harbor 이미지 서명 실행 | MUST | cosign sign 성공 + .sig 태그 확인 |
| FR-N27.3 | 이미지 서명 검증 | MUST | cosign verify 통과 (exit 0) |
| FR-N27.4 | Kyverno 서명 검증 정책 YAML | MUST | ClusterPolicy YAML 생성 |
| FR-N27.5 | CI/CD 서명 자동화 워크플로우 | SHOULD | Gitea Actions YAML 작성 |

---

## 추적성 매트릭스

| FR ID | CSAP 항목 | 산출물 | 테스트 |
|-------|---------|--------|--------|
| FR-N27.1 | D-09-01 | infra/cosign/cosign.pub | TC-N27.1 |
| FR-N27.2 | D-05-03, D-12-08 | cosign sign 실행 로그 | TC-N27.2 |
| FR-N27.3 | D-05-03, D-12-08 | cosign verify 실행 로그 | TC-N27.3 |
| FR-N27.4 | D-08, D-12-08 | infra/kyverno/verify-image-signature.yaml | TC-N27.4 |
| FR-N27.5 | D-12-01 | .gitea/workflows/sign-image.yaml | TC-N27.5 |
