---
sidebar_position: 3
---

# Gitea CI/CD

3종 파이프라인이 제공됩니다:

| 파이프라인 | 파일 | 트리거 |
|---------|------|--------|
| CI | `.gitea/workflows/ci.yml` | Push/PR |
| 보안 검사 | `.gitea/workflows/security.yml` | 주간 cron |
| 배포 | `.gitea/workflows/deploy.yml` | main 머지 |
