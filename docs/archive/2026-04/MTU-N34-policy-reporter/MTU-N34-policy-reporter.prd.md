# PRD: MTU-N34 Kyverno Policy Reporter 설치

| 항목 | 내용 |
|------|------|
| 문서 ID | PRD-N34-001 |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-09 |
| 작성자 | PM Lead (Opus 4.6) |
| MTU | MTU-N34 |
| 복잡도 | MED |

---

## WHY (목적)

Kyverno가 Enforce 모드로 전환되어 정책 위반 시 배포가 차단되지만, 현재 정책 적용 결과를 시각적으로 확인할 수 있는 수단이 없음. Policy Reporter를 통해 PolicyReport CRD 결과를 UI 대시보드와 Prometheus 메트릭으로 시각화하여, 보안 운영자가 정책 준수 현황을 한눈에 파악할 수 있도록 함.

## WHO (이해관계자)

- 보안 운영자: 정책 위반 현황 모니터링
- 클러스터 관리자: 정책 적용 상태 확인
- 감리인: CSAP D-05/D-12 준수 증적 시각화

## RISK

- Policy Reporter가 리소스를 과도하게 사용할 수 있음 (WSL2 메모리 제한)
- reportsController가 비활성화되어 있어 PolicyReport 생성이 제한될 수 있음
- Grafana 대시보드 ConfigMap 충돌 가능성

## SUCCESS (성공 기준)

1. Policy Reporter Helm Chart 설치 완료 (policy-reporter NS)
2. Policy Reporter UI 접근 가능 (NodePort)
3. Kyverno Plugin 활성화 + 정책 결과 시각화
4. Prometheus ServiceMonitor 연동 (기존 kube-prometheus-stack)
5. Grafana 대시보드 자동 프로비저닝

## SCOPE

- IN: Policy Reporter Core + UI + Kyverno Plugin + Monitoring subchart
- OUT: Elasticsearch/Loki 연동 (향후), Slack 알림 (향후)
