# 메트릭 학습 순서

> **목표**: Prometheus로 메트릭을 수집하고 Grafana로 시각화할 수 있다

---

## 메트릭이란?

메트릭은 시스템 상태를 숫자로 표현한 것입니다. 체온계가 몸 상태를 숫자로 알려주듯이, Prometheus는 서비스 상태를 숫자로 수집합니다.

```
체온 38.5도 → 열이 있다
CPU 95%    → 서버가 바쁘다
에러율 5%  → 100번 중 5번 실패
```

---

## 학습 순서

1. **`01-prometheus-basics.md`** — Prometheus 기초: 메트릭 종류 이해 + PromQL 작성법 + 내 서비스 메트릭 수집 설정
2. **`02-grafana-guide.md`** — Grafana 사용법: 대시보드 만들기 + 알림 설정 + 실습

---

## 사전 준비

- Kubernetes 기초 (Pod, Service, Namespace 개념)
- `kubectl` 명령어 기본 사용법

준비가 되었으면 `01-prometheus-basics.md`부터 시작하십시오.
