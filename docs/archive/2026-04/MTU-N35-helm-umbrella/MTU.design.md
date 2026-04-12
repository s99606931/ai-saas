# Design: MTU-N35 Helm Umbrella Chart

| 항목 | 내용 |
|------|------|
| 문서 ID | DESIGN-N35-001 |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-09 |
| 작성자 | PM Lead (Opus 4.6) |
| Plan 참조 | PLAN-N35-001 |

---

## Design Anchor

- **목표**: saas-platform 전체 스택을 Helm Umbrella Chart로 통합
- **제약**: 기존 kustomize 배포와 병행, WSL2 리소스 제한
- **선택**: Option B (Pragmatic Balance) -- 공통 라이브러리 + 개별 하위 차트

---

## 디렉토리 구조

```
infra/helm/saas-platform/
  Chart.yaml              -- Umbrella Chart 정의
  values.yaml             -- 기본 values
  values-dev.yaml         -- 개발 환경
  values-stg.yaml         -- 스테이징 환경
  charts/
    common/               -- 공통 라이브러리 차트
      Chart.yaml
      templates/
        _helpers.tpl      -- 공통 헬퍼 함수
        _deployment.tpl   -- 표준 Deployment 템플릿
        _service.tpl      -- 표준 Service 템플릿
        _serviceaccount.tpl
    api-gateway/          -- (기존 차트 symlink 또는 복사)
    auth-service/
    user-service/
    ...
```

## 공통 라이브러리 차트 설계

모든 마이크로서비스가 동일한 패턴을 공유:
- Deployment (replicas, image, resources, healthCheck, env)
- Service (ClusterIP, port)
- ServiceAccount

`common` 라이브러리 차트에서 named template으로 정의하고,
각 하위 차트에서 `include`로 호출.

## 환경별 Values 전략

| 환경 | 파일 | replicas | resources | 비고 |
|------|------|---------|-----------|------|
| dev | values-dev.yaml | 1 | 최소 (32Mi) | WSL2 로컬 |
| stg | values-stg.yaml | 1 | 표준 (64Mi) | 테스트 환경 |
| prod | values.yaml | 2+ | 운영 (128Mi+) | 프로덕션 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 초안 작성 | PM Lead |
