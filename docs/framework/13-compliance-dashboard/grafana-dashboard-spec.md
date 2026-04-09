# Grafana 대시보드 패널 명세

> MTU-A6 | FR-7.3 | 적용 기준일: 2026-04-05

---

## 대시보드 1: CSAP 79항목 준수율

| 패널 | 시각화 | PromQL | 설명 |
|------|--------|--------|------|
| 전체 준수율 | Stat | `sum(csap_control_status==1)/79*100` | 79항목 완료 비율 |
| 분야별 완료율 | Bar Chart | `csap_domain_completion_ratio*100` | D-01~D-13 |
| 미완료 항목 | Table | `csap_control_status==0` | 즉시 조치 필요 |
| 완료 추이 | Time Series | `sum(csap_control_status) over time` | 시간별 증가 |

## 대시보드 2: N2SF 6영역

| 패널 | 시각화 | 설명 |
|------|--------|------|
| 6영역 현황 | Pie Chart | N-01~N-06 완료/진행/미착수 |
| 등급별 분포 | Bar Chart | C/S/O 데이터 분류 현황 |
| AI 차단 현황 | Stat | C/S등급 차단 건수 |

## 대시보드 3: ISMS-P 101항목

| 패널 | 시각화 | 설명 |
|------|--------|------|
| 전체 준수율 | Gauge | 0~100% |
| 카테고리별 | Heatmap | 관리(16)/보호(64)/개인정보(21) |
| CSAP 교차 항목 | Table | ISMS-P - CSAP 중복 목록 |

## 대시보드 4: 감리 준비도

| 패널 | 시각화 | 설명 |
|------|--------|------|
| 통합 점수 | Stat (대형) | 0~100점, 색상별 |
| 요소별 점수 | Bar Chart | CSAP/N2SF/ISMS-P/산출물/테스트 |
| 추이 | Time Series | 주간 준비도 점수 변화 |

---

## 데이터소스 설정

```yaml
# Grafana provisioning
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    url: http://prometheus:9090
    access: proxy
    isDefault: true
  - name: Loki
    type: loki
    url: http://loki:3100
    access: proxy
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | MTU-A6 Do — Grafana 패널 명세 작성 | Implementer Agent |
