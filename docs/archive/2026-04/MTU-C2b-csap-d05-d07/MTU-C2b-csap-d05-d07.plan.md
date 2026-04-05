# MTU-C2b: CSAP D05~D07 구현 가이드 (공급망·침해사고·재해복구)

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-C2b |
| Phase | Phase 2 Core Security |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| FR 매핑 | FR-2.3b (D05~D07 분야) |
| 의존 MTU | MTU-C1, MTU-C2a |
| 예상 세션 | 1 세션 |
| 분할 근거 | CTO 검토 R-03: MTU-C2 분할 |

---

## 목적

CSAP 표준등급 D05~D07 분야 (공급망·침해사고·재해복구) 구현 가이드를 제공합니다.

**시장조사 연계**:
- D05 (서비스 공급망): MTU-C8 SBOM + Sigstore와 연결
- D06 (침해사고): audit.jsonl + 감사로그 자동화와 연결
- D07 (재해복구): k3s 백업/복구 절차(MTU-I1)와 연결

---

## 산출물 파일 (3개)

| 파일 | CSAP 분야 | 항목 수 | 핵심 내용 |
|------|---------|---------|---------|
| `02-csap/standard-grade/implementation-guide/D05-supply-chain.md` | 서비스 공급망 관리 | 4 | 공급업체 계약, SBOM 관리, 취약점 알림 체계 |
| `02-csap/standard-grade/implementation-guide/D06-incident.md` | 침해사고 관리 | 5 | 침해 탐지, 대응 절차, 보고, audit.jsonl 연동 |
| `02-csap/standard-grade/implementation-guide/D07-disaster-recovery.md` | 재해 복구 | 3 | RTO/RPO 목표, 백업 절차, 복구 훈련 |

---

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|---------|
| FR-2.3b-1 | D05 서비스 공급망 관리 가이드 | 공급업체 계약 체크리스트 + SBOM 관리 절차 + MTU-C8 연동 링크 포함 |
| FR-2.3b-2 | D06 침해사고 관리 가이드 | 침해사고 대응 절차 5단계 + audit.jsonl 연동 예시 + 신고 체계 포함 |
| FR-2.3b-3 | D07 재해복구 계획 가이드 | RTO ≤ 4시간 / RPO ≤ 1시간 목표 + 백업 스케줄 + 복구 훈련 절차 포함 |

---

## 시험 시나리오

| 시나리오 ID | 시험 방법 | 검증 내용 | 합격 기준 |
|-----------|---------|---------|---------|
| TS-C2b-01 | 문서 검토 | D05 SBOM 관리 절차 완전성 | SBOM 생성→저장→배포→업데이트 4단계 포함 |
| TS-C2b-02 | 기능 시험 | D06 audit.jsonl 연동 | 침해사고 이벤트 audit.jsonl 기록 확인 |
| TS-C2b-03 | 문서 검토 | D07 RTO/RPO 목표 명시 | RTO ≤ 4시간, RPO ≤ 1시간 수치 명기 |
| TS-C2b-04 | 설정 검토 | D07 백업 스케줄 설정 | 자동 백업 설정 증거(cron 또는 Velero 설정) 확인 |
| TS-C2b-05 | 체크리스트 | CSAP-D05~D07 전수 항목 포함 여부 | 3개 분야 12항목 누락 0건 |

---

## 합격 기준

1. D05 SBOM 관리 → MTU-C8 (`sbom-guide.md`) 참조 링크
2. D06 감사로그 → `audit.jsonl` 연동 예시 포함
3. D07 RTO/RPO 수치 명시 (RTO ≤ 4시간, RPO ≤ 1시간)
4. 각 항목 증거 자료 목록 완비

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | MTU-C2 분할 — CTO 검토 R-03 반영 | Claude Code |
| 0.2.0 | 2026-04-05 | P1: FR-2.3 → FR-2.3b (FR ID 분리), 산출물 전체 경로 명시, NFR-3 잘못된 참조 수정, 기능 요구사항 및 시험 시나리오 추가 | Claude Code |
