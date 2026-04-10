# MTU-N74: SRE Runbook 자동화 + 황금 신호 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead (Opus)

---

## 1. 4대 황금 신호 Recording Rules

| 신호 | 메트릭 | Recording Rule |
|------|--------|---------------|
| Latency | HTTP 요청 지연 P50/P95/P99 | `saas:http_request_duration_seconds:p99` |
| Traffic | 초당 요청 수 | `saas:http_requests_total:rate5m` |
| Errors | 5xx 에러율 | `saas:http_errors_total:rate5m` |
| Saturation | CPU/Memory 사용률 | `saas:resource_saturation:ratio` |

---

## 2. Runbook 목록 (10종)

| # | Runbook | 트리거 알림 | 자동화 수준 |
|---|---------|-----------|-----------|
| 1 | Pod CrashLoopBackOff 대응 | KubePodCrashLooping | 자동: 로그 수집 + 알림 |
| 2 | 고지연 (P99 > 1s) 대응 | HighLatencyP99 | 반자동: HPA 스케일링 |
| 3 | 에러율 급증 (>5%) 대응 | HighErrorRate | 반자동: 최근 배포 롤백 |
| 4 | 디스크 용량 부족 대응 | NodeDiskPressure | 자동: 로그 로테이션 |
| 5 | 인증서 만료 임박 대응 | CertificateExpiringSoon | 자동: cert-manager 갱신 |
| 6 | OOM 킬 빈발 대응 | ContainerOOMKilled | 반자동: VPA 권고 적용 |
| 7 | Node NotReady 대응 | KubeNodeNotReady | 자동: 워크로드 재스케줄링 |
| 8 | DB 연결 풀 고갈 대응 | PostgresConnectionPoolExhausted | 반자동: 연결 풀 확장 |
| 9 | Flux Drift 감지 대응 | FluxDriftDetected | 자동: 강제 재조정 |
| 10 | 보안 이벤트 대응 (Falco) | FalcoSecurityEvent | 자동: Pod 격리 + 알림 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
