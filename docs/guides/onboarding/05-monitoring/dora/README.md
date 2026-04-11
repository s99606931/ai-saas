# DORA 메트릭 학습 순서

> **목표**: DORA 4대 지표의 의미를 이해하고 팀의 배포 성과를 파악할 수 있다

---

## DORA란?

DORA(DevOps Research and Assessment)는 구글이 수년간 수천 개 팀을 연구하여 "개발팀이 얼마나 잘하고 있는가"를 측정하는 4가지 지표를 정의했습니다.

```
높은 DORA 점수 = 빠르고 안정적인 배포
낮은 DORA 점수 = 느리고 위험한 배포
```

---

## 학습 순서

1. **`01-dora-metrics.md`** — DORA 4대 지표 이해, dora-exporter 연동, 좋은 점수를 위한 습관

---

## 우리 팀 DORA 현황 보기

```bash
# 현재 DORA 등급 확인
kubectl port-forward -n monitoring svc/dora-exporter 8080:8080
curl http://localhost:8080/metrics | grep dora_team_level

# Grafana 대시보드에서 확인
# http://localhost:30300 → DORA Metrics 대시보드
```
