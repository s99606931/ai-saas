# Plan: MTU-N32 Helm 실전 배포 테스트

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N32 |
| 작성일 | 2026-04-08 |
| 복잡도 | HIGH |
| 버전 | 1.0 |

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | Helm 기반 배포로 운영 안정성 및 버전 관리 역량 확보 |
| 기술 | Helm Chart 작성 + helm install/upgrade/rollback 전 주기 검증 |
| 보안 | CSAP D-12 시스템 개발보안 (배포 자동화) |
| 운영 | 기존 kustomize 배포와 분리된 helm-test NS에서 독립 검증 |

## Context Anchor

- **WHY**: 프로덕션 배포 표준인 Helm 차트 실전 검증 필요
- **WHO**: DevOps 엔지니어, 개발자
- **RISK**: 기존 kustomize 배포와 리소스 충돌
- **SUCCESS**: helm install → Pod Running → health check → upgrade → rollback
- **SCOPE**: api-gateway 단일 서비스 Helm Chart

## 기능 요구사항

| FR ID | 요구사항 | 검증 방법 | CSAP 매핑 |
|-------|---------|---------|----------|
| FR-N32.1 | Helm Chart 구조 완성 | helm lint 통과 | D-12 |
| FR-N32.2 | helm install 성공 | helm list -n helm-test | D-12 |
| FR-N32.3 | Pod Running + Health Check | curl health endpoint | D-07 |
| FR-N32.4 | helm upgrade/rollback 검증 | helm history 확인 | D-12 |
| FR-N32.5 | Helm 배포 가이드 문서 | 문서 존재 확인 | D-12 |

## 산출물 목록

| 산출물 | 경로 | 형식 |
|--------|------|------|
| Helm Chart | infra/helm/api-gateway/ | Chart 구조 |
| Chart.yaml | infra/helm/api-gateway/Chart.yaml | YAML |
| values.yaml | infra/helm/api-gateway/values.yaml | YAML |
| Templates | infra/helm/api-gateway/templates/ | YAML |
| 배포 가이드 | docs/07-infra/helm-deployment-guide.md | Markdown |

## 실행 순서

1. infra/helm/api-gateway/ 디렉토리 + Chart 구조 생성
2. templates/ (deployment, service, configmap, hpa) 작성
3. values.yaml 기본값 설정
4. helm lint 검증
5. helm-test 네임스페이스 생성 + helm install
6. Pod Running + health check 확인
7. values 변경 + helm upgrade + rollback 테스트
8. 가이드 문서 작성
