# Design: MTU-N173 MLflow 모델 레지스트리 CI/CD 통합

> 버전: 1.0 | 작성일: 2026-04-10

## 1. Design Anchor

- Plan: docs/01-plan/mtus/MTU-N173-mlflow-model-registry.plan.md
- 핵심 결정: MLflow OSS + KServe + Gitea Actions

## 2. 아키텍처

```
모델 학습 ──→ MLflow 실험 추적 ──→ 모델 레지스트리
                                       │
                                  CI 검증 파이프라인
                                       │
                                  Stage: Staging → Production
                                       │
                                  KServe InferenceService 배포
                                       │
                                  A/B 트래픽 분할 + 드리프트 감지
```

## 3. 상세 설계

### 3.1 MLflow 서버 배포
- PostgreSQL: 메타데이터 저장
- MinIO: 모델 아티팩트 저장 (S3 호환)
- 리소스: 500m CPU / 1Gi Memory

### 3.2 모델 레지스트리
- 모델 스테이지: None → Staging → Production → Archived
- 버전 자동 증가
- 모델 설명/태그/주석 관리

### 3.3~3.8 실험 추적, CI/CD, 드리프트 감지, A/B 테스트 등
