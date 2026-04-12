# MTU-N169: 자동 인증서 갱신 모니터링 — Plan

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead  
> **Phase**: Round 15 — 모니터링 고도화  
> **의존**: MTU-N62 (cert-manager 기본 설정)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | TLS 인증서 만료로 인한 서비스 중단 방지 (CSAP D-09 암호화 연속성) |
| 기술 | cert-manager 메트릭 기반 자동 갱신 추적 + Grafana 대시보드 |
| 운영 | 인증서 수명주기 완전 가시화, 갱신 실패 자동 복구 |
| 규제 | CSAP D-09 암호화 요건, N2SF 통신 보안 영역 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 인증서 자동 갱신 실패 시 TLS 통신 중단 → 서비스 장애 → CSAP D-09 위반 |
| WHO | SRE 팀, 인프라 관리자, 보안 담당자 |
| RISK | 갱신 실패 미탐지, 만료 알림 미수신, ClusterIssuer 오류 |
| SUCCESS | 인증서 갱신 성공률 99.9%, 만료 7일 전 알림 100% |
| SCOPE | cert-manager 메트릭, Prometheus 규칙, Grafana 대시보드, 갱신 자동화 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | 검증 기준 |
|----|---------|---------|----------|
| FR-N169.1 | 인증서 수명주기 Grafana 대시보드 | HIGH | 만료일, 갱신일, 발급일 시각화 |
| FR-N169.2 | 인증서 갱신 이력 추적 메트릭 | HIGH | 갱신 시도/성공/실패 카운터 |
| FR-N169.3 | 갱신 실패 자동 재시도 정책 | HIGH | 최대 5회, 지수 백오프 |
| FR-N169.4 | 인증서 인벤토리 자동 수집 | MED | 전체 네임스페이스 인증서 목록 |
| FR-N169.5 | Issuer 상태 모니터링 알림 | MED | ClusterIssuer/Issuer 비정상 탐지 |
| FR-N169.6 | 인증서 체인 유효성 검증 | MED | Root → Intermediate → Leaf 체인 확인 |

## 비기능 요구사항

| ID | 요구사항 | 기준 |
|----|---------|------|
| NFR-N169.1 | 메트릭 수집 주기 | 60초 이내 |
| NFR-N169.2 | 알림 지연 | 탐지 후 5분 이내 |
| NFR-N169.3 | 대시보드 로딩 | 3초 이내 |
| NFR-N169.4 | 리소스 오버헤드 | CPU 50m, 메모리 64Mi 이하 |

## 추적성 매트릭스

| FR ID | Design | 구현 파일 | 테스트 | CSAP |
|-------|--------|----------|--------|------|
| FR-N169.1 | §3 대시보드 | grafana-dashboard.json | 대시보드 패널 확인 | D-09 |
| FR-N169.2 | §4 메트릭 | prometheus-rules.yaml | 메트릭 쿼리 검증 | D-06 |
| FR-N169.3 | §5 재시도 | retry-policy.yaml | 갱신 실패 시뮬레이션 | D-09 |
| FR-N169.4 | §6 인벤토리 | cert-inventory-exporter.yaml | 인증서 수집 검증 | D-09 |
| FR-N169.5 | §7 알림 | alerting-rules-enhanced.yaml | 알림 발생 검증 | D-09 |
| FR-N169.6 | §8 체인 | chain-validation.yaml | 체인 검증 테스트 | D-09 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
