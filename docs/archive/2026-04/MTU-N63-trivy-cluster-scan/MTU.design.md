# MTU-N63: Trivy Operator 클러스터 보안 스캔 설계

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: security-architect

---

## 1. 아키텍처

```
Trivy Operator (trivy-system 네임스페이스)
  ├── 이미지 취약점 스캔 → VulnerabilityReport CR
  ├── 워크로드 설정 감사 → ConfigAuditReport CR
  ├── CIS Benchmark → ComplianceReport CR
  └── Prometheus Exporter → 메트릭 노출
```

## 2. Helm Values 설계

- operator.replicas: 1
- trivy.mode: Standalone (온프레미스, 외부 서비스 미사용)
- trivy.severity: CRITICAL,HIGH,MEDIUM
- compliance.cron: "0 */6 * * *" (6시간 주기)
- scanJobsConcurrentLimit: 3
- Prometheus: serviceMonitor.enabled=true

## 3. 알림 규칙

- TrivyCriticalVulnerability: Critical 취약점 발견 즉시 critical
- TrivyHighVulnerability: High 취약점 10개 초과 warning
- TrivyConfigAuditFailed: 설정 감사 실패 항목 존재 warning

## 4. Grafana 대시보드

- 취약점 분포 (Critical/High/Medium/Low)
- 네임스페이스별 취약 이미지 수
- CIS 벤치마크 준수율
- 스캔 이력 타임라인

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | security-architect |
