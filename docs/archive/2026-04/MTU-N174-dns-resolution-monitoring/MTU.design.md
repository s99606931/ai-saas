# MTU-N174: DNS 해석 모니터링 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead

---

## 컴포넌트 구조

```
infra/monitoring/dns/
├── dns-monitoring-dashboard.json     (FR-N174.1)
├── dns-alerting-rules.yaml           (FR-N174.2)
├── dns-recording-rules.yaml          (FR-N174.3, N174.5)
└── nxdomain-detector.yaml            (FR-N174.4)
```

## Design Anchor

- CoreDNS 네이티브 메트릭 (coredns_*) 활용
- 기존 CoreDNS 설정 변경 없음

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
