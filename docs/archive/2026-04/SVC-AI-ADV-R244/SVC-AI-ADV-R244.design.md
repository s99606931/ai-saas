# SVC-AI-ADV-R244 — 보안 인증 자동화 Design

> 작성일: 2026-04-13 | 버전: 1.0.0

## 컴포넌트 설계

```
SecurityCertificationAI
├── registerCertification(id, name, expiryDate, items[])
├── recordItemCheck(certId, itemId, passed, evidence, grade)
├── getExpiryAlerts(thresholdDays): ExpiryAlert[]
│   └── 만료까지 thresholdDays 이내 → 알림 생성
├── generateReport(certId): CertificationReport
│   ├── passRate: number
│   ├── failedItems: string[]
│   └── expiryStatus: 'valid' | 'expiring_soon' | 'expired'
└── getAuditLog(): AuditEntry[]
```

## 핵심 알고리즘

- **만료 계산**: (expiryDate - now) / ms_per_day ≤ thresholdDays
- **통과율**: passed items / total items * 100
- **만료 상태**: 만료일 < now → expired, < now+30d → expiring_soon

## CSAP D-06 준수

- 인증 항목 체크 전수 감사 로그
- N2SF C/S 등급 차단
