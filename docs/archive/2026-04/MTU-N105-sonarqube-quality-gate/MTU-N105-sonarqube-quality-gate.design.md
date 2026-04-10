# MTU-N105: SonarQube 경량 코드 품질 게이트 — Design

> **MTU ID**: MTU-N105
> **Phase**: 9라운드 CI/CD DevOps 고도화
> **작성일**: 2026-04-10

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | SonarQube CE로 코드 품질 정량 관리 및 감리 증빙 자동화 |
| 기술 | Helm 기반 k3s 배포, Gitea Actions CI 파이프라인 연동 |
| 보안 | CSAP D-12 시스템 개발 보안 자동 검증, OWASP 패턴 탐지 |
| 운영 | 품질 게이트 실패 시 PR 머지 자동 차단 |

## 아키텍처 옵션 분석

### Option A: SonarQube Operator (복잡)
- Kubernetes Operator로 전체 생명주기 관리
- 과도한 리소스: PostgreSQL 별도 필요
- 판정: 과잉

### Option B: SonarQube CE Helm 경량 배포 (Pragmatic Balance) [선택]
- Community Edition + 내장 H2/PostgreSQL
- 최소 리소스: 1GB RAM, 0.5 CPU
- Gitea Actions에서 sonar-scanner CLI 직접 호출
- 품질 게이트 API로 PR 차단 결정

### Option C: SonarQube 없이 커스텀 린트 집계 (최소)
- ESLint + Semgrep 결과 집계 스크립트
- 종합 대시보드 부재, 트렌드 추적 불가
- 판정: 불충분

## 상세 설계

### DS-N105.1: Helm 배포 구조

```yaml
# infra/sonarqube/values.yaml
namespace: sonarqube
image: sonarqube:community-lts
resources:
  requests: { cpu: 500m, memory: 1Gi }
  limits: { cpu: 1000m, memory: 2Gi }
persistence:
  size: 5Gi
  storageClass: local-path
ingress:
  enabled: true
  host: sonar.local
```

### DS-N105.2: Gitea Actions 워크플로우

```yaml
name: SonarQube Scan
on: [pull_request]
jobs:
  sonar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with: { fetch-depth: 0 }
      - name: SonarQube Scan
        run: |
          sonar-scanner \
            -Dsonar.host.url=$SONAR_HOST \
            -Dsonar.token=$SONAR_TOKEN \
            -Dsonar.projectKey=ai-saas
      - name: Quality Gate Check
        run: scripts/sonar-quality-gate-check.sh
```

### DS-N105.3: 품질 게이트 정책

| 메트릭 | 임계값 | 조건 |
|--------|--------|------|
| 신규 버그 | 0 | 신규 코드 기준 |
| 신규 취약점 | 0 | 신규 코드 기준 |
| 신규 코드 스멜 등급 | A | 신규 코드 기준 |
| 신규 코드 중복률 | 3% 이하 | 신규 코드 기준 |
| 신규 코드 커버리지 | 80% 이상 | 신규 코드 기준 |
| 보안 핫스팟 리뷰율 | 100% | 전체 기준 |

### DS-N105.5: PR 차단 메커니즘

```bash
#!/bin/bash
# sonar-quality-gate-check.sh
SONAR_URL="${SONAR_HOST}/api/qualitygates/project_status"
STATUS=$(curl -s -u "${SONAR_TOKEN}:" "${SONAR_URL}?projectKey=ai-saas" | jq -r '.projectStatus.status')
if [ "$STATUS" != "OK" ]; then
  echo "품질 게이트 실패: $STATUS"
  exit 1
fi
```

## Session Guide

1. Helm values 작성 -> 2. Gitea 워크플로우 작성 -> 3. sonar-project.properties 작성 -> 4. 품질 게이트 정책 문서 -> 5. PR 차단 스크립트 -> 6. E2E 테스트

## Design Anchor

- Plan SC: FR-N105.1~FR-N105.6 전수 반영
- CSAP: D-12 시스템 개발 보안 준수
- N2SF: 자체 호스팅으로 O등급 데이터만 처리
