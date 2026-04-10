# MTU-N71: Pod Security Standards Restricted 프로필 강제 적용

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead (Opus)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | CSAP D-08 접근통제 강화, 공공기관 보안 감리 최고 수준 대응 |
| 기술 | Kubernetes PSA Restricted 프로필 네임스페이스 전환, Kyverno 보조 정책 |
| 보안 | 특권 컨테이너 완전 차단, hostPath/hostNetwork 금지, 최소 권한 원칙 |
| 운영 | 점진적 전환 (audit→warn→enforce), 기존 워크로드 100% 호환 보장 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 현재 baseline PSS만 적용. CSAP D-08 및 공공기관 보안 감사 시 restricted 프로필 필수 |
| WHO | 보안 담당자, 감리 위원, SRE 팀, 개발자 |
| RISK | 기존 워크로드 restricted 위반 시 Pod 배포 실패 |
| SUCCESS | 전 앱 네임스페이스 restricted enforce, 기존 워크로드 100% 호환, 위반 감사 로깅 |
| SCOPE | PSA 라벨 적용, 워크로드 securityContext 수정, Kyverno 보조 정책, 검증 테스트 |

---

## 기능 요구사항

| FR ID | 요구사항 | 수용 기준 | CSAP 매핑 |
|-------|---------|----------|----------|
| FR-N71.1 | PSA Restricted 네임스페이스 라벨 적용 | 모든 앱 NS에 enforce=restricted 라벨 | D-08-01 |
| FR-N71.2 | 시스템 NS 예외 처리 | kube-system, flux-system 등 기반 NS는 privileged/baseline 유지 | D-08-02 |
| FR-N71.3 | 워크로드 securityContext 수정 | 모든 Deployment/StatefulSet restricted 호환 | D-12-03 |
| FR-N71.4 | Kyverno 보조 정책 (감사 로깅) | restricted 위반 시도 audit.jsonl 자동 기록 | D-06-01 |
| FR-N71.5 | PSS 검증 테스트 스크립트 | 특권 컨테이너 배포 시도 → 차단 확인 15건 | D-08-05 |

---

## 비기능 요구사항

| NFR ID | 요구사항 | 수용 기준 |
|--------|---------|----------|
| NFR-N71.1 | Zero-downtime 전환 | 기존 서비스 무중단 |
| NFR-N71.2 | 감사 로그 보존 | 위반 이벤트 append-only 로깅 |

---

## 산출물

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | PSS 네임스페이스 라벨 매니페스트 | `infra/security/pod-security-standards/` |
| 2 | Kyverno PSS 감사 정책 | `infra/kyverno/policies/pss-restricted-audit.yaml` |
| 3 | securityContext 패치 값 | 각 Helm values.yaml 업데이트 |
| 4 | 검증 테스트 스크립트 | `scripts/test-pss-restricted.sh` |

---

## 추적성 매트릭스

| FR ID | 산출물 | 테스트 | CSAP |
|-------|--------|--------|------|
| FR-N71.1 | PSS 매니페스트 | test-pss-restricted.sh #1~3 | D-08-01 |
| FR-N71.2 | PSS 매니페스트 (예외) | test-pss-restricted.sh #4~6 | D-08-02 |
| FR-N71.3 | Helm values | test-pss-restricted.sh #7~10 | D-12-03 |
| FR-N71.4 | Kyverno 정책 | test-pss-restricted.sh #11~12 | D-06-01 |
| FR-N71.5 | 테스트 스크립트 | test-pss-restricted.sh #13~15 | D-08-05 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
