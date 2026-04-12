# MTU-N81: 취약점 자동 패치 파이프라인 — Design

> **MTU ID**: MTU-N81
> **Plan 참조**: docs/01-plan/mtus/MTU-N81-vuln-auto-patch.plan.md
> **작성일**: 2026-04-10

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| 스캔 엔진 | Trivy Operator (기존 인프라) + Grype (CI) |
| 트리거 | CronJob (4시간 주기) + 웹훅 이벤트 |
| 패치 방법 | 이미지 리빌드 + Renovate PR |
| 검증 | 스테이징 자동 배포 + E2E 테스트 |
| 알림 | Prometheus AlertManager → Slack/Email |

## 아키텍처

```
Trivy Operator (4h scan)
    │
    ▼
CVE 발견 → Prometheus Alert
    │
    ├── Critical/High → 즉시 리빌드 트리거
    │     ├── Gitea Action: 이미지 리빌드
    │     ├── 스테이징 자동 배포
    │     ├── E2E 테스트 실행
    │     └── 통과 시 프로덕션 PR 자동 생성
    │
    ├── Medium → Renovate 주간 PR에 포함
    │
    └── Low → 월간 정리에 포함
```

## SLA 정책

| 심각도 | MTTR 목표 | 자동화 | 에스컬레이션 |
|--------|----------|--------|------------|
| Critical (CVSS 9.0+) | 4시간 | 즉시 리빌드 | 15분 후 팀 리드 |
| High (CVSS 7.0-8.9) | 24시간 | 즉시 PR 생성 | 4시간 후 팀 리드 |
| Medium (CVSS 4.0-6.9) | 1주일 | 주간 PR | 3일 후 알림 |
| Low (CVSS 0.1-3.9) | 1개월 | 월간 정리 | 2주 후 알림 |
