# MTU-N61: Grafana 공공기관 SaaS 특화 대시보드 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead (Opus)

---

## 1. 대시보드 설계

### 1.1 CSAP 준수 현황 대시보드 (FR-N61.1)

**패널 구성**:
- Row 1: CSAP 영역별 준수율 게이지 (D-01~D-13)
- Row 2: 정책 위반 트렌드 (Kyverno + Gatekeeper)
- Row 3: 보안 이벤트 타임라인 (Falco)
- Row 4: 감사 로그 통계 (일별 감사 이벤트 수)

### 1.2 테넌트 리소스 대시보드 (FR-N61.2)

**패널 구성**:
- Row 1: 테넌트 선택 변수 (namespace 기반)
- Row 2: CPU/메모리/디스크 사용량 게이지
- Row 3: 요청 비율 + 에러율 (recording rules 활용)
- Row 4: 리소스 사용 트렌드 (7일)

### 1.3 인증/보안 이벤트 대시보드 (FR-N61.3)

**패널 구성**:
- Row 1: 인증 성공/실패 비율
- Row 2: 로그인 실패 Top 10 IP
- Row 3: 토큰 만료/갱신 통계
- Row 4: RBAC 접근 거부 이벤트

---

## 2. 기술 상세

### 2.1 Recording Rules 활용 (FR-N61.4)

대시보드에서 직접 복잡 쿼리 대신 MTU-N57에서 정의한 recording rules를 참조합니다:
- `node:cpu_utilization:ratio` → 노드 CPU
- `service:http_errors:ratio_rate5m` → 서비스 에러율
- `namespace:cpu_usage:sum` → 네임스페이스별 CPU
- `slo:error_budget:remaining_ratio` → SLO 에러 버짓

### 2.2 Grafana Variable (FR-N61.5)

```json
{
  "templating": {
    "list": [
      {
        "name": "namespace",
        "type": "query",
        "query": "label_values(kube_namespace_status_phase, namespace)",
        "multi": true
      },
      {
        "name": "service",
        "type": "query",
        "query": "label_values(service:http_requests:rate5m, service)",
        "multi": true
      }
    ]
  }
}
```

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
