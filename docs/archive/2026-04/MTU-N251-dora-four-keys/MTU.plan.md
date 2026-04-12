# MTU-N251: DORA Four Keys 완전 자동화 계획서

> **문서 ID**: MTU-N251.plan
> **작성일**: 2026-04-11
> **작성자**: PM Lead (AI)
> **버전**: 1.0.0
> **상태**: 승인됨

---

## Executive Summary (4관점 테이블)

| 관점 | 내용 |
|------|------|
| **비즈니스** | DORA Four Keys 메트릭 완전 자동화로 DevOps 성숙도를 정량 측정하고, 공공기관 감리 시 DevOps 성숙도 증빙 제공 |
| **기술** | Gitea webhook 기반 이벤트 수집 → DORA Exporter → Prometheus Recording Rules → Grafana 대시보드 + CI/CD 연동 |
| **보안/규제** | CSAP D-06 침해사고 관리 (MTTR 측정), D-12 시스템 개발 보안 (CI/CD 품질 측정), 행안부 감리 증빙 |
| **운영** | SRE 팀의 의사결정 자동화 — 배포 승인/거부를 DORA 등급 기반으로 자동 판단 |

---

## Context Anchor

### WHY
- 기존 DORA Recording Rules (MTU-N126)는 Kubernetes 메트릭 프록시 방식으로 정밀도 부족
- Gitea commit → merge → deploy 전체 파이프라인 리드타임 추적 부재
- 변경 실패율이 CrashLoopBackOff 기반으로만 측정되어 롤백/핫픽스 미반영
- CI/CD 파이프라인 품질 게이트와 DORA 등급 연동 부재

### WHO
- DevOps 엔지니어: 일일/주간 DORA 대시보드 모니터링
- SRE 팀: MTTR/CFR 기반 인시던트 대응 프로세스 개선
- 감리원: DevOps 성숙도 정량 증빙 확인
- 관리자: 팀별 DORA 등급 비교 및 개선 추적

### RISK
| 위험 | 영향 | 완화 |
|------|------|------|
| Gitea API 가용성 | 이벤트 유실 | 로컬 큐 + 재시도 로직 |
| 메트릭 카디널리티 폭발 | Prometheus OOM | 레이블 제한 (namespace, team) |
| 감리 증빙 불충분 | 감리 결함 | 주간 PDF 보고서 자동 생성 |

### SUCCESS (수용 기준)
| ID | 기준 | 측정 방법 |
|----|------|----------|
| SC-1 | Deployment Frequency 자동 측정 (Gitea webhook 기반) | DORA 대시보드에서 일/주/월 배포 횟수 확인 |
| SC-2 | Lead Time for Changes 추적 (commit → deploy 전 구간) | P50/P90/P99 리드타임 표시 |
| SC-3 | MTTR 자동 계산 (인시던트 생성~해결) | 인시던트별 복구 시간 히스토리 |
| SC-4 | Change Failure Rate 정밀 측정 (롤백+핫픽스 포함) | CFR% 대시보드 패널 |
| SC-5 | DORA 등급 자동 판정 (Elite/High/Medium/Low) | 4개 메트릭 종합 등급 표시 |
| SC-6 | CI/CD 파이프라인 DORA 게이트 연동 | CFR > 30% 시 배포 차단 |
| SC-7 | Grafana 대시보드 (Four Keys 통합 뷰) | 대시보드 JSON 존재 |

### SCOPE
**포함**: DORA Exporter, Grafana 대시보드, CI/CD 게이트 연동, 알림 규칙, 보고서 자동화
**제외**: 외부 SaaS 연동 (Sleuth, LinearB 등), 유료 도구

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | SC 매핑 |
|-------|---------|---------|---------|
| FR-N251.1 | DORA Exporter: Gitea webhook 이벤트 수집 및 Prometheus 메트릭 노출 | P0 | SC-1,2,3,4 |
| FR-N251.2 | Deployment Frequency: 네임스페이스/팀별 일/주/월 배포 횟수 | P0 | SC-1 |
| FR-N251.3 | Lead Time for Changes: commit SHA → deploy 타임스탬프 추적 | P0 | SC-2 |
| FR-N251.4 | MTTR: 인시던트 생성~해결 시간 자동 측정 | P0 | SC-3 |
| FR-N251.5 | Change Failure Rate: 롤백/핫픽스/CrashLoop 종합 | P0 | SC-4 |
| FR-N251.6 | DORA 등급 자동 판정 (Four Keys 기준 Elite~Low) | P0 | SC-5 |
| FR-N251.7 | Grafana 대시보드 (Four Keys 통합 뷰 + 추세) | P0 | SC-7 |
| FR-N251.8 | CI/CD DORA 게이트: CFR 임계값 초과 시 배포 차단 | P1 | SC-6 |
| FR-N251.9 | DORA 주간 보고서 자동 생성 (Markdown + 감리 증빙) | P1 | SC-5 |

---

## 추적성 매트릭스

| FR ID | Design 섹션 | 구현 파일 | 테스트 | CSAP |
|-------|------------|----------|--------|------|
| FR-N251.1 | §3.1 | infra/monitoring/dora-exporter/ | 단위 테스트 | D-06, D-12 |
| FR-N251.2 | §3.2 | infra/monitoring/dora-metrics-rules-v2.yaml | Recording Rule 검증 | D-06 |
| FR-N251.3 | §3.2 | infra/monitoring/dora-metrics-rules-v2.yaml | 리드타임 측정 검증 | D-06 |
| FR-N251.4 | §3.3 | infra/monitoring/dora-metrics-rules-v2.yaml | MTTR 계산 검증 | D-06 |
| FR-N251.5 | §3.4 | infra/monitoring/dora-metrics-rules-v2.yaml | CFR 측정 검증 | D-06 |
| FR-N251.6 | §3.5 | infra/monitoring/dora-metrics-rules-v2.yaml | 등급 판정 검증 | D-06 |
| FR-N251.7 | §3.6 | infra/monitoring/dashboards/dora-four-keys.json | 대시보드 렌더링 | D-06 |
| FR-N251.8 | §3.7 | .gitea/workflows/dora-gate.yml | 게이트 통과/차단 | D-12 |
| FR-N251.9 | §3.8 | scripts/generate-dora-report-v2.sh | 보고서 생성 검증 | D-06 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | PM Lead (AI) |
