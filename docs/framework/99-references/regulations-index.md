# 외부 규정 인덱스

| 항목 | 내용 |
|------|------|
| 문서 ID | REF-INDEX |
| 버전 | 0.1.0 |
| 최종 수정일 | 2026-04-05 |
| 커버리지 | 14/14 (100%) |
| 자동 검증 | Auditor 에이전트 (매 Phase 완료 시) |
| FR 매핑 | FR-0.4 (외부 규정 인덱스 완비) |

<!-- Design Ref: MTU-F2-references.design.md 3.1절 -- 매핑 테이블형 설계 -->

---

## 1. 적용 범위 및 목적

본 문서는 공공기관 SaaS 프레임워크에서 참조하는 모든 외부 규정, 법령, 가이드라인의 **단일 출처(Single Source of Truth)**입니다.

프레임워크의 다른 문서에서 규정을 참조할 때는 반드시 본 문서의 `REF-XX` ID를 사용하여 참조합니다.

**유효성 관리 주기**: 분기 1회 전체 규정 URL 유효성 점검 및 개정 여부 확인

---

## 2. 규정 인덱스

### 2.1 클라우드 보안 인증

| REF ID | 규정명 | 영문 표기 | 발행 기관 | 최신 버전/고시 | 시행일 | URL | 프레임워크 적용 영역 | 유효성 확인 주기 | 비고 |
|--------|-------|---------|---------|-------------|-------|-----|-------------------|--------------|------|
| REF-01 | CSAP 보안인증 기준 (표준등급) | Cloud Security Assurance Program (Standard) | KISA | 2023 개정 | 2023년 | https://isms.kisa.or.kr/main/csap/intro/ | MTU-C1, MTU-C2a, MTU-C2b, MTU-C3, MTU-F4 | 분기 1회 | 2026 상반기 N2SF 통합 개편 착수 예정. 79개 통제항목 |
| REF-02 | CSAP 보안인증 기준 (중요등급) | Cloud Security Assurance Program (Critical) | KISA | 2023 개정 | 2023년 | https://isms.kisa.or.kr/main/csap/intro/ | MTU-A5 (상등급 추가 요건) | 분기 1회 | 동일 개편 대상 |

### 2.2 국가 망 보안체계

| REF ID | 규정명 | 영문 표기 | 발행 기관 | 최신 버전/고시 | 시행일 | URL | 프레임워크 적용 영역 | 유효성 확인 주기 | 비고 |
|--------|-------|---------|---------|-------------|-------|-----|-------------------|--------------|------|
| REF-03 | 국가 망 보안체계 보안가이드라인 | National Network Security Framework (N2SF) Guidelines v1.0 | 국가정보원 | v1.0 (2025-09 정식판) | 2025-09 (CSK 2025 공개) | https://www.nis.go.kr | MTU-C4, MTU-C5, MTU-I5, MTU-A7 | 분기 1회 | 보안통제 176개에서 260여개로 확장. C/S/O 3등급 분류. 2026 하반기 본격 시행 |
| REF-13 | N2SF CSK 2025 발표 자료 | N2SF Cyber Summit Korea 2025 Presentation | 국가정보원 | 2025-09 | 2025-09 | https://www.ncsc.go.kr | MTU-C4, MTU-C5 | 연 1회 | 보안통제 6개 항목 상세: 권한, 인증, 분리/격리, 통제, 데이터, 정보자산 |

### 2.3 정보보호 관리체계

| REF ID | 규정명 | 영문 표기 | 발행 기관 | 최신 버전/고시 | 시행일 | URL | 프레임워크 적용 영역 | 유효성 확인 주기 | 비고 |
|--------|-------|---------|---------|-------------|-------|-----|-------------------|--------------|------|
| REF-05 | ISMS-P 인증 기준 | Information Security Management System - Personal Information | KISA | 2023 | 2023년 | https://isms.kisa.or.kr/main/ | MTU-C6a, MTU-C6b, MTU-E1 | 분기 1회 | **2027-07 의무화 확정**. 대상 107개 기관(공공 57 + 민간 50). 미인증 시 과태료 3천만원. 예비심사 신설 예정 |

### 2.4 감리 및 전자정부

| REF ID | 규정명 | 영문 표기 | 발행 기관 | 최신 버전/고시 | 시행일 | URL | 프레임워크 적용 영역 | 유효성 확인 주기 | 비고 |
|--------|-------|---------|---------|-------------|-------|-----|-------------------|--------------|------|
| REF-04 | 정보시스템 감리기준 | Information System Audit Standards | 행정안전부 | 고시 제2023-1호 | 2023년 | https://www.mois.go.kr | MTU-F5, MTU-A3a, MTU-A3b, MTU-A3c | 분기 1회 | 착수/분석/설계/구현/시험 5단계 감리 |
| REF-08 | 전자정부법 | Electronic Government Act | 행정안전부 | 2024 개정 | 2024년 | https://www.law.go.kr | 전체 (공공 시스템 기본법) | 분기 1회 | |

### 2.5 개인정보 보호

| REF ID | 규정명 | 영문 표기 | 발행 기관 | 최신 버전/고시 | 시행일 | URL | 프레임워크 적용 영역 | 유효성 확인 주기 | 비고 |
|--------|-------|---------|---------|-------------|-------|-----|-------------------|--------------|------|
| REF-06 | 개인정보 보호법 | Personal Information Protection Act (PIPA) | 개인정보보호위원회 | 2023 개정 | 2023년 | https://www.pipc.go.kr | 전체 (PII 처리 관련) | 분기 1회 | AI 시대 개인정보 처리 가이드라인 업데이트 진행 |

### 2.6 클라우드 및 정보보안

| REF ID | 규정명 | 영문 표기 | 발행 기관 | 최신 버전/고시 | 시행일 | URL | 프레임워크 적용 영역 | 유효성 확인 주기 | 비고 |
|--------|-------|---------|---------|-------------|-------|-----|-------------------|--------------|------|
| REF-07 | 클라우드컴퓨팅 발전 및 이용자 보호에 관한 법률 | Cloud Computing Development and User Protection Act | 과학기술정보통신부 | 2023 | 2023년 | https://www.msit.go.kr | MTU-F4, MTU-C1 | 분기 1회 | |
| REF-09 | 공공기관 정보보안 지침 | Public Institution Information Security Guidelines | 행정안전부 | 2024 | 2024년 | https://www.mois.go.kr | MTU-C2a, MTU-C2b, MTU-C3 | 분기 1회 | |
| REF-14 | CSAP-N2SF 제도 통합 방안 | CSAP-N2SF System Integration Plan | 과학기술정보통신부 | 2025-12 (발표) | 미시행 | https://www.etnews.com/20251212000235 | 전체 (제도 통합) | 분기 1회 | 2026 상반기 법령 개정 착수. CSAP 없이 보안적합성 검증만으로 공공 진출 가능 예정 |

### 2.7 국제 표준

| REF ID | 규정명 | 영문 표기 | 발행 기관 | 최신 버전/고시 | 시행일 | URL | 프레임워크 적용 영역 | 유효성 확인 주기 | 비고 |
|--------|-------|---------|---------|-------------|-------|-----|-------------------|--------------|------|
| REF-10 | NIST SP 800-53 Rev.5 | Security and Privacy Controls for Information Systems | NIST | Rev.5 (2020) | 2020년 | https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final | MTU-A4 (OSCAL 매핑 기반) | 연 1회 | |
| REF-11 | NIST OSCAL 명세 | Open Security Controls Assessment Language | NIST | 1.1.2 | 2024년 | https://pages.nist.gov/OSCAL/ | MTU-A4 | 연 1회 | 기계가독형 보안 통제 매핑 |
| REF-12 | OWASP Top 10 | Open Web Application Security Project Top 10 | OWASP Foundation | 2021 | 2021년 | https://owasp.org/Top10/ | MTU-C3 (D12 시스템 개발 보안) | 연 1회 | 차기 버전 2025 발표 예정 |

---

## 3. 규정 역참조 매트릭스

본 섹션은 각 MTU가 참조하는 규정을 역추적할 수 있도록 정리합니다.

| MTU ID | MTU명 | 참조 규정 |
|--------|-------|---------|
| MTU-F1 | Getting Started 레이어 | (전체 규정 개요 언급) |
| MTU-F2 | 참조 기반 레이어 | 본 문서 |
| MTU-F3 | 개발 표준 가이드 | REF-01, REF-12 |
| MTU-F4 | CSAP 간편등급 | REF-01, REF-07 |
| MTU-F5 | 감리 산출물 T01~T02 | REF-04 |
| MTU-F6 | CC 하네스 완성도 검증 | (하네스 자체 검증) |
| MTU-C1 | CSAP 마스터 체크리스트 | REF-01, REF-07 |
| MTU-C2a | CSAP D01~D04 구현 가이드 | REF-01, REF-09 |
| MTU-C2b | CSAP D05~D07 구현 가이드 | REF-01, REF-09 |
| MTU-C3 | CSAP D08~D13 구현 가이드 | REF-01, REF-12 |
| MTU-C4 | N2SF 등급 분류 + 매핑 | REF-03, REF-13 |
| MTU-C5 | N2SF 6개 영역 통제 | REF-03, REF-13 |
| MTU-C6a | ISMS-P 체크리스트 | REF-05 |
| MTU-C6b | ISMS-P 증적 자동화 | REF-05 |
| MTU-C7 | Policy as Code | REF-03 |
| MTU-C8 | Supply Chain Security | REF-01 |
| MTU-I1 | k3s WSL2 클러스터 | REF-03 |
| MTU-I2 | Gitea CI/CD | REF-04 |
| MTU-I3 | Flux GitOps + Harbor | REF-03 |
| MTU-I4 | 네트워크 보안 + OTel | REF-03 |
| MTU-I5 | N2SF 레퍼런스 아키텍처 | REF-03, REF-13 |
| MTU-A1 | AI 보안 게이트웨이 + MCP | REF-03, REF-06 |
| MTU-A2 | LM Studio 연동 | REF-03, REF-06 |
| MTU-A3a | 감리 산출물 T03~T04 | REF-04 |
| MTU-A3b | 감리 산출물 T05~T06 | REF-04 |
| MTU-A3c | 감리 체크리스트 5종 | REF-04 |
| MTU-A4 | OSCAL 호환성 레이어 | REF-10, REF-11 |
| MTU-A5 | Docusaurus 문서 포털 | 전체 |
| MTU-A6 | 준수 현황 대시보드 | REF-01, REF-03, REF-05 |
| MTU-A7 | N2SF 모니터링 프로세스 | REF-03, REF-13 |
| MTU-E1 | ISMS-P 2027 의무화 | REF-05, REF-14 |
| MTU-E2 | 멀티테넌시 SaaS | REF-03 |
| MTU-E3 | 프레임워크 업그레이드 | 전체 |

---

## 4. 향후 주요 규정 변경 일정 (2026~2027)

| 시기 | 규정 변경 | 영향도 | 대응 사항 |
|------|---------|--------|---------|
| 2026 상반기 | CSAP-N2SF 제도 통합 법령 개정 착수 | **상** | REF-01, REF-02, REF-14 업데이트. CSAP 없이 보안적합성 검증으로 공공 진출 가능 |
| 2026 하반기 | N2SF 본격 시행 | **상** | REF-03 업데이트. 260여개 통제항목 최종 확정 |
| 2026년 | ISMS-P 대개편 (예비심사 신설) | **중** | REF-05 업데이트. 현장실증형 심사 도입 |
| 2027-07 | ISMS-P 의무화 시행 | **상** | REF-05 업데이트. MTU-E1 실행 필요 |
| 2025~2026 | OWASP Top 10 차기 버전 | **하** | REF-12 업데이트 시 MTU-C3 점검 |

---

## 5. 관련 문서 참조

본 문서는 프레임워크 최하위 기반 레이어로서, 다른 문서를 참조하지 않습니다.
다른 모든 문서가 본 문서를 참조합니다.

---

## 6. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 -- 14건 규정 인덱스. 2026 웹검색 기반 최신 규정 반영 (N2SF v1.0, ISMS-P 2027 의무화, CSAP-N2SF 통합) | Claude Code (PM Lead) |
