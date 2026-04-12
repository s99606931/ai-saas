# MTU-N85: 감사 보고서 자동 생성 — Design

> **MTU ID**: MTU-N85
> **Plan 참조**: docs/01-plan/mtus/MTU-N85-audit-report-gen.plan.md
> **작성일**: 2026-04-10

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| 생성 주기 | 주간 (월요일 06:00) + 온디맨드 |
| 입력 | CSAP 증거 (MTU-N84), Kyverno 정책 보고서, 감사 로그 |
| 출력 | JSON + 콘솔 보고서 |
| 드리프트 탐지 | Kyverno PolicyReport + 스냅샷 비교 |

## 아키텍처

```
┌─ CronJob: compliance-report-gen (주간) ──┐
│                                          │
│  입력:                                    │
│  ├── CSAP 증거 아카이브                    │
│  ├── Kyverno ClusterPolicyReport          │
│  ├── Trivy VulnerabilityReport            │
│  ├── .claude/audit.jsonl                  │
│  └── 이전 스냅샷 (드리프트 비교)           │
│                                          │
│  처리:                                    │
│  ├── 79개 통제항목 준수율 계산             │
│  ├── 드리프트 탐지 (변경사항 식별)          │
│  ├── 감리 체크리스트 자동 점검             │
│  └── 보고서 생성 (JSON)                   │
│                                          │
│  출력:                                    │
│  ├── reports/{date}/compliance-report.json │
│  ├── Prometheus 메트릭 (준수율)            │
│  └── 알림 (미준수 항목 발견 시)            │
└──────────────────────────────────────────┘
```

## 규정 준수 드리프트 탐지 방법

| 유형 | 탐지 방법 | 예시 |
|------|----------|------|
| RBAC 드리프트 | ClusterRoleBinding 스냅샷 비교 | 권한 에스컬레이션 |
| 정책 드리프트 | Kyverno PolicyReport fail 증가 | PSS 위반 Pod |
| 네트워크 드리프트 | NetworkPolicy 변경 감지 | 포트 개방 |
| 암호화 드리프트 | 인증서 만료/변경 | TLS 인증서 교체 누락 |
| 취약점 드리프트 | VulnerabilityReport 신규 CVE | Critical CVE 발생 |
