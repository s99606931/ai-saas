# Plan: MTU-N173 MLflow 모델 레지스트리 CI/CD 통합

> 버전: 1.0 | 작성일: 2026-04-10

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | AI/ML 모델 생명주기 관리 자동화, 모델 거버넌스 |
| 기술 | MLflow + KServe + Gitea Actions CI/CD |
| 보안 | 모델 서명 검증, N2SF O등급 모델 메타데이터만 저장 |
| 운영 | 모델 등록→검증→배포→모니터링 자동 파이프라인 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-ML.1 | MLflow 서버 Helm 배포 (PostgreSQL + MinIO) | HIGH |
| FR-ML.2 | 모델 레지스트리 (버전 관리, 스테이지 전환) | HIGH |
| FR-ML.3 | 실험 추적 (파라미터, 메트릭, 아티팩트) | HIGH |
| FR-ML.4 | 모델 CI 파이프라인 (학습→검증→등록) | HIGH |
| FR-ML.5 | 모델 CD 파이프라인 (KServe InferenceService) | HIGH |
| FR-ML.6 | 모델 드리프트 감지 (입력/출력 분포 모니터링) | MED |
| FR-ML.7 | A/B 테스트 프레임워크 (트래픽 분할) | MED |
| FR-ML.8 | 모델 거버넌스 대시보드 (Grafana) | MED |
