# SRE Runbook 목록

> Design Ref: MTU-N74 §2
> 장애 시나리오 10종 자동화 Runbook

| # | Runbook | 트리거 알림 | 자동화 수준 | 파일 |
|---|---------|-----------|-----------|------|
| 1 | Pod CrashLoopBackOff | KubePodCrashLooping | 자동 | `01-crashloop.md` |
| 2 | 고지연 P99 > 1s | HighLatencyP99 | 반자동 | `02-high-latency.md` |
| 3 | 에러율 급증 >5% | HighErrorRate | 반자동 | `03-high-error-rate.md` |
| 4 | 디스크 용량 부족 | NodeDiskPressure | 자동 | `04-disk-space.md` |
| 5 | 인증서 만료 임박 | CertificateExpiringSoon | 자동 | `05-cert-expiry.md` |
| 6 | OOM 킬 빈발 | ContainerOOMKilled | 반자동 | `06-oom-kill.md` |
| 7 | Node NotReady | KubeNodeNotReady | 자동 | `07-node-notready.md` |
| 8 | DB 연결 풀 고갈 | PostgresConnectionPoolExhausted | 반자동 | `08-db-pool.md` |
| 9 | Flux Drift 감지 | FluxDriftDetected | 자동 | `09-flux-drift.md` |
| 10 | 보안 이벤트 (Falco) | FalcoSecurityEvent | 자동 | `10-security-event.md` |
