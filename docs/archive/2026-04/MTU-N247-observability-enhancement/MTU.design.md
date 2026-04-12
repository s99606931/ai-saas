# Design: MTU-N247 관찰성 고도화

> **버전**: 1.0.0 | **작성일**: 2026-04-11 | **작성자**: PM Lead (infra-architect)

---

## Design Anchor

| 항목 | 값 |
|------|---|
| 프로파일링 | Pyroscope (Grafana 프로젝트) |
| 트레이싱 | OpenTelemetry (기존 스택 활용) |
| 메트릭 | Prometheus + VictoriaMetrics |
| 시각화 | Grafana (프로비저닝 자동화) |

---

## S3. 상세 설계

### S3.1 Pyroscope 통합 (FR-N247.1, FR-N247.2)

Pyroscope는 지속적 프로파일링 도구로, CPU/메모리 사용 패턴을 실시간 수집합니다.
OTel SDK가 이미 적용된 서비스에서 프로파일 데이터를 Pyroscope로 전송합니다.

```
Service (OTel SDK) → Pyroscope Agent/SDK → Pyroscope Server
                                              ↓
                                        Grafana 대시보드
```

### S3.2 SLO 대시보드 (FR-N247.3)

Grafana 프로비저닝으로 다음 SLO 패널 자동 생성:
- 서비스별 가용성 (99.9% SLO)
- 응답 시간 p99 (500ms SLO)
- 에러 버짓 잔여량
- 30일 롤링 SLO 추이

### S3.3 이상 감지 규칙 (FR-N247.4)

Z-score 기반 이상 감지:
```
(현재값 - 7일 평균) / 7일 표준편차 > 3 → 알림
```

적용 대상: CPU, 메모리, 응답 시간, 에러율

### S3.4 에러 버짓 알림 (FR-N247.5)

```
에러 버짓 소진율 = 1 - (실제 가용성 / SLO 목표)
30일 기준 에러 버짓에서:
  50% 소진 → INFO
  70% 소진 → WARNING
  90% 소진 → CRITICAL (배포 동결 권고)
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 최초 설계 | PM Lead (infra-architect) |
