# Plan: MTU-N31 Kyverno Enforce 전환

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N31 |
| 작성일 | 2026-04-08 |
| 복잡도 | MED |
| 버전 | 1.0 |

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 미서명 이미지 배포 차단으로 CSAP 공급망 보안 요건 완전 충족 |
| 기술 | Kyverno v1.14.x Helm 설치 + ClusterPolicy Enforce 모드 전환 |
| 보안 | CSAP D-05-03, D-12-08 실시간 이미지 서명 검증 |
| 운영 | webhook failurePolicy=Ignore로 가용성 보장 |

## Context Anchor

- **WHY**: Audit 모드 YAML만 존재, 실제 차단 기능 미동작
- **WHO**: DevOps 엔지니어, 보안 감사관
- **RISK**: Enforce 전환 시 미서명 Pod 차단 → 기존 서비스 영향
- **SUCCESS**: 미서명 이미지 거부 + 기존 서비스 무중단
- **SCOPE**: Kyverno 설치 + 정책 적용 + 검증 + 가이드

## 기능 요구사항

| FR ID | 요구사항 | 검증 방법 | CSAP 매핑 |
|-------|---------|---------|----------|
| FR-N31.1 | Kyverno Helm Chart 설치 (kyverno NS) | kubectl get pods -n kyverno | D-12-08 |
| FR-N31.2 | verify-image-signature Enforce 적용 | kubectl get cpol -o yaml | D-05-03 |
| FR-N31.3 | 미서명 이미지 배포 차단 검증 | kubectl run 미서명 → 거부 확인 | D-05-03 |
| FR-N31.4 | 기존 서비스 정상 운영 확인 | kubectl get pods 36+ Running | D-07 |
| FR-N31.5 | Enforce 전환 가이드 문서 | 문서 존재 확인 | D-12 |

## 산출물 목록

| 산출물 | 경로 | 형식 |
|--------|------|------|
| Kyverno Enforce 정책 | infra/kyverno/verify-image-signature.yaml | YAML |
| Kyverno values | infra/kyverno/values.yaml | YAML |
| 전환 가이드 | docs/07-infra/kyverno-enforce-guide.md | Markdown |
| PDCA 문서 | docs/01-plan, 02-design, 04-report | Markdown |

## 실행 순서

1. Kyverno Helm repo 추가 + 설치 (failurePolicy=Ignore)
2. 설치 확인 (3개 Pod Running)
3. Audit 모드로 정책 적용 → 기존 Pod 영향 확인
4. Enforce 모드로 전환
5. 미서명 이미지 배포 시도 → 거부 확인
6. 기존 서비스 안정성 확인
7. 가이드 문서 작성
