# MTU-N169: 자동 인증서 갱신 모니터링 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead  
> **Plan 참조**: MTU-N169-cert-renewal-monitoring.plan.md

---

## 1. 아키텍처 옵션 분석

| 옵션 | 설명 | 장점 | 단점 |
|------|------|------|------|
| A. 네이티브 메트릭만 사용 | cert-manager 기본 Prometheus 메트릭 활용 | 추가 컴포넌트 불필요 | 갱신 이력 추적 제한적 |
| B. 커스텀 Exporter 추가 | 전용 인증서 상태 Exporter 개발 | 세밀한 메트릭 | 개발/유지보수 비용 |
| **C. Pragmatic Balance** | 네이티브 메트릭 + Recording Rule + Grafana | 균형 잡힌 가시성 | 없음 |

**선택: 옵션 C** — cert-manager 네이티브 메트릭을 Recording Rule로 확장하고 Grafana 대시보드로 통합.

## 2. 컴포넌트 구조

```
infra/cert-manager/
├── values.yaml                      (기존 — 변경 없음)
├── alerting-rules.yaml              (기존 — 변경 없음, 보존)
├── monitoring/
│   ├── cert-lifecycle-dashboard.json    (FR-N169.1)
│   ├── prometheus-recording-rules.yaml  (FR-N169.2)
│   ├── alerting-rules-enhanced.yaml     (FR-N169.5)
│   ├── cert-inventory-configmap.yaml    (FR-N169.4)
│   └── renewal-retry-policy.yaml        (FR-N169.3)
└── validation/
    └── chain-validation-cronjob.yaml    (FR-N169.6)
```

## 3. Grafana 대시보드 설계 (FR-N169.1)

### 패널 구성

| 행 | 패널 | 쿼리 | 유형 |
|----|------|------|------|
| 1 | 인증서 만료 타임라인 | certmanager_certificate_expiration_timestamp_seconds | Time series |
| 1 | 인증서 Ready 현황 | certmanager_certificate_ready_status | Stat |
| 2 | 갱신 성공/실패 추이 | cert_renewal_total by result | Bar chart |
| 2 | Issuer 상태 | certmanager_controller_sync_call_count | Table |
| 3 | 인증서 인벤토리 | cert_inventory_info | Table |
| 3 | 만료 임박 순위 | sort(certmanager_certificate_expiration_timestamp_seconds) | Bar gauge |

## 4. Prometheus Recording Rule 설계 (FR-N169.2)

| 규칙명 | 표현식 | 목적 |
|--------|--------|------|
| cert:days_until_expiry | (expiration_ts - time()) / 86400 | 만료까지 남은 일수 |
| cert:renewal_success_rate_5m | rate(success) / rate(total) | 5분 갱신 성공률 |
| cert:total_certificates | count(certmanager_certificate_ready_status) | 전체 인증서 수 |
| cert:not_ready_count | count(...{condition="False"}) | 미준비 인증서 수 |

## 5. 갱신 재시도 정책 (FR-N169.3)

- **최대 재시도**: 5회
- **백오프**: 지수 백오프 (1m → 2m → 4m → 8m → 16m)
- **조건**: CertificateRequest 실패 시 자동 재발급
- **알림**: 3회 실패 시 WARNING, 5회 실패 시 CRITICAL

## 6. 인증서 인벤토리 수집 (FR-N169.4)

CronJob으로 전체 네임스페이스 인증서 목록을 주기적으로 수집:
- 실행 주기: 매 6시간
- 수집 항목: 이름, 네임스페이스, 발급자, 만료일, DNS 이름, 상태
- 출력: ConfigMap 메트릭 노출

## 7. Issuer 알림 강화 (FR-N169.5)

기존 alerting-rules.yaml 을 보존하면서 추가 알림 규칙:

| 알림 | 조건 | 심각도 |
|------|------|--------|
| CertIssuerNotReady | Issuer condition != Ready 10분 | critical |
| CertRenewalBackoffExceeded | 재시도 5회 초과 | critical |
| CertChainValidationFailed | 체인 검증 실패 | critical |
| CertInventoryDrift | 기대 인증서 수 불일치 | warning |

## 8. 인증서 체인 유효성 검증 (FR-N169.6)

CronJob으로 TLS 인증서 체인 검증:
- openssl verify 활용
- Root CA → Intermediate → Leaf 검증
- 실패 시 메트릭 노출 + 알림

## 9. CSAP/N2SF 매핑

| CSAP | 항목 | 구현 |
|------|------|------|
| D-09 | 암호화 | 인증서 갱신 연속성 보장 |
| D-06 | 감사 | 갱신 이력 전수 기록 |
| D-09.3 | 키 관리 | 인증서 수명주기 추적 |

## Design Anchor

- 모든 구현은 이 Design 문서의 컴포넌트 구조를 따름
- cert-manager 기존 설정(values.yaml, alerting-rules.yaml)은 변경하지 않음
- 신규 파일만 monitoring/ 및 validation/ 하위에 생성

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
