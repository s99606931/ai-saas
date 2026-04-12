# MTU-N79: Renovate Bot 의존성 자동 갱신 — Design

> **MTU ID**: MTU-N79
> **Plan 참조**: docs/01-plan/mtus/MTU-N79-renovate-bot.plan.md
> **작성일**: 2026-04-10
> **상태**: Design 완료

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 옵션 | C: Pragmatic Balance — CronJob + renovate.json5 |
| 배포 방식 | K8s CronJob (renovate/renovate:latest 이미지) |
| 설정 관리 | ConfigMap으로 renovate.json5 마운트 |
| 시크릿 관리 | ExternalSecret → Gitea API 토큰 |
| PR 정책 | 주간 그룹 PR + 심각도별 자동머지 |

## 아키텍처 설계

### 컴포넌트 구조

```
┌─────────────────────────────────────────────┐
│  K8s CronJob: renovate-bot                  │
│  Schedule: 0 2 * * * (매일 02:00 UTC)       │
│  Image: renovate/renovate:38                │
│                                             │
│  ┌─────────────┐    ┌──────────────────┐    │
│  │ ConfigMap    │    │ ExternalSecret   │    │
│  │ renovate.json5│   │ gitea-api-token │    │
│  └─────────────┘    └──────────────────┘    │
└─────────────┬───────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────┐
│  Gitea Server                               │
│  - PR 자동 생성 (dependency-update 라벨)     │
│  - CI 파이프라인 자동 트리거                  │
│  - 자동머지 (low/med 심각도)                 │
└─────────────────────────────────────────────┘
```

### renovate.json5 주요 설정

```json5
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "platform": "gitea",
  "extends": [
    "config:recommended",
    "security:openssf-scorecard",
    ":dependencyDashboard"
  ],
  "schedule": ["before 6am on monday"],
  "timezone": "Asia/Seoul",
  "labels": ["dependency-update", "automated"],
  "packageRules": [
    {
      "description": "Helm chart 업데이트 그룹",
      "matchManagers": ["helm-values", "helmv3"],
      "groupName": "helm-charts",
      "schedule": ["before 6am on monday"]
    },
    {
      "description": "Docker 이미지 패치 자동머지",
      "matchManagers": ["dockerfile", "docker-compose"],
      "matchUpdateTypes": ["patch"],
      "automerge": true,
      "automergeType": "pr"
    },
    {
      "description": "보안 취약점 즉시 PR",
      "matchCategories": ["security"],
      "schedule": ["at any time"],
      "automerge": false,
      "labels": ["security", "urgent"]
    },
    {
      "description": "major 버전 수동 검토",
      "matchUpdateTypes": ["major"],
      "automerge": false,
      "labels": ["major-update", "manual-review"]
    }
  ],
  "vulnerabilityAlerts": {
    "enabled": true,
    "labels": ["security-vulnerability"]
  }
}
```

### CronJob 매니페스트 설계

- Namespace: `renovate-system`
- ServiceAccount: RBAC 최소 권한
- Resource Limits: CPU 500m, Memory 512Mi
- SecurityContext: runAsNonRoot, readOnlyRootFilesystem
- ConfigMap: renovate.json5 설정
- Secret: Gitea API 토큰 (ExternalSecret 연동)

### 자동머지 정책

| 업데이트 유형 | 심각도 | 자동머지 | 조건 |
|-------------|--------|---------|------|
| patch | low/none | 자동 | CI 통과 |
| minor | low/med | 자동 | CI + 스테이징 통과 |
| major | any | 수동 | 팀 리뷰 필수 |
| security | critical | 수동 | 긴급 리뷰 후 배포 |
| security | high | 수동 | 24시간 내 리뷰 |
| security | med/low | 자동 | CI 통과 |

### CSAP D-12 매핑

| D-12 항목 | Renovate 대응 |
|-----------|-------------|
| D-12.1 안전한 코딩 | 의존성 자동 갱신으로 최신 보안 패치 적용 |
| D-12.2 소스코드 보안 | 취약 의존성 자동 탐지 및 교체 |
| D-12.3 오픈소스 관리 | renovate.json5 그룹 정책으로 체계적 관리 |

## Session Guide

1. infra/renovate/ 디렉토리 생성
2. CronJob 매니페스트 작성 (PSS Restricted 준수)
3. renovate.json5 전역 설정 작성
4. ExternalSecret 연동 설정
5. Gitea 웹훅 연동 ConfigMap
6. 자동머지 정책 YAML 작성
7. E2E 테스트 스크립트 작성
8. NetworkPolicy 설정 (Gitea 통신만 허용)
