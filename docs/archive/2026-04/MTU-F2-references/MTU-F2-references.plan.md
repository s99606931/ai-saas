# MTU-F2: 참조 기반 레이어

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-F2 |
| Phase | Phase 1 Foundation |
| 상태 | Draft |
| 작성일 | 2026-04-05 |
| FR 매핑 | FR-0.4, FR-0.5 |
| 의존 MTU | 없음 (최초 독립 MTU) |
| 예상 세션 | 1 세션 |

---

## 목적

프레임워크 전체에서 참조하는 외부 규정, 법령, 가이드라인의 단일 출처(Single Source of Truth)를 확립합니다. 다른 모든 MTU가 이 MTU를 의존성으로 참조하므로, Phase 1에서 가장 먼저 완료되어야 합니다.

**핵심 가치**: 규정 변경(N2SF 개정, CSAP 기준 변경 등) 시 이 파일 한 곳만 업데이트하면 전체 프레임워크에 반영됩니다.

---

## 산출물 파일 (2개)

| 파일 | 문서 유형 | 핵심 내용 |
|------|---------|---------|
| `99-references/regulations-index.md` | 매핑 테이블형 | 외부 규정 원문 링크 + 버전 + 유효일 목록 |
| `99-references/glossary-and-acronyms.md` | 참조형 | 용어 정의 30개 이상 + 약어 목록 완비 |

---

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|---------|
| FR-0.4 | 외부 규정 인덱스 완비 | CSAP·N2SF·감리기준·ISMS-P 등 10개 이상 규정 링크 |
| FR-0.5 | 용어·약어 정의 완비 | 용어 정의 30개 이상, 약어 전수 해설 |

---

## 핵심 설계 내용

### regulations-index.md 구성

다음 규정을 포함하는 인덱스 테이블을 작성합니다.

| 번호 | 규정명 | 발행 기관 | 최신 버전/고시 | URL | 프레임워크 적용 영역 |
|------|-------|---------|-------------|-----|-------------------|
| REF-01 | CSAP 보안인증 기준 (표준등급) | KISA | 2023 개정 | https://isms.kisa.or.kr | MTU-C1~C3, MTU-A5 |
| REF-02 | CSAP 보안인증 기준 (중요등급) | KISA | 2023 개정 | https://isms.kisa.or.kr | MTU-A5 |
| REF-03 | 국가정보보안 기본지침 (N2SF) | 국가정보원 | 2024 개정 | https://www.nis.go.kr | MTU-C4, MTU-C5, MTU-I5 |
| REF-04 | 정보시스템 감리기준 (고시 제2023-1호) | 행정안전부 | 2023 | https://www.mois.go.kr | MTU-F5, MTU-A3a~c |
| REF-05 | ISMS-P 인증 기준 | KISA | 2023 | https://isms.kisa.or.kr | MTU-C6a, MTU-C6b |
| REF-06 | 개인정보 보호법 | 개인정보보호위원회 | 2023 개정 | https://www.pipc.go.kr | 전체 (PII 처리 관련) |
| REF-07 | 클라우드컴퓨팅법 | 과학기술정보통신부 | 2023 | https://www.msit.go.kr | MTU-F4, MTU-C1 |
| REF-08 | 전자정부법 | 행정안전부 | 2024 개정 | https://www.mois.go.kr | 전체 |
| REF-09 | 공공기관 정보보안 지침 | 행정안전부 | 2024 | https://www.mois.go.kr | MTU-C2, MTU-C3 |
| REF-10 | NIST SP 800-53 Rev.5 | NIST | 2020 | https://csrc.nist.gov | MTU-A6 (OSCAL 매핑) |
| REF-11 | NIST OSCAL 명세 | NIST | 1.1.2 | https://pages.nist.gov/OSCAL | MTU-A6 |
| REF-12 | OWASP Top 10 (2021) | OWASP | 2021 | https://owasp.org/Top10 | MTU-C3 (D12) |

**유효성 관리**: 각 규정의 최신 버전 확인 주기는 분기 1회. 개정 시 `CHANGELOG.md` 기록 필수.

### glossary-and-acronyms.md 구성

**용어 정의 섹션** (가나다순, 30개 이상):

다음 용어를 포함하는 용어 정의를 작성합니다. 각 용어는 영문 표기, 정의, 관련 규정 참조를 포함합니다.

| 번호 | 한글 용어 | 영문 표기 | 정의 | 관련 규정 |
|------|---------|---------|------|---------|
| G-01 | 감리 | IT Audit | 정보화사업의 품질·적합성·완결성을 제3자가 확인하는 행위 | REF-04 |
| G-02 | 감사 로그 | Audit Log | 시스템에서 발생한 보안 관련 이벤트의 시간 순서 기록 | REF-01 |
| G-03 | 공공 SaaS | Public SaaS | 공공기관이 사용하는 Software as a Service 클라우드 서비스 | REF-07 |
| G-04 | 국가정보보안 기본지침 | N2SF | 국가정보원이 발행하는 정보보안 분류 및 통제 체계 | REF-03 |
| G-05 | 기능 요구사항 | Functional Requirement | 시스템이 수행해야 하는 기능적 동작을 명시한 요건 | REF-04 |
| G-06 | 데이터 분류 등급 | Data Classification Level | N2SF에 따른 C(중요)·S(민감)·O(공개) 3등급 분류 체계 | REF-03 |
| G-07 | 매핑 테이블 | Mapping Table | 두 체계 간 항목 대응 관계를 표로 정리한 문서 | — |
| G-08 | 비기능 요구사항 | Non-Functional Requirement | 성능·보안·가용성 등 기능 외 시스템 속성 요건 | REF-04 |
| G-09 | 사업계획서 | Business Plan | 정보화사업 착수 시 제출하는 사업 목적·범위·예산·일정 문서 | REF-04 |
| G-10 | 산출물 | Deliverable | 프로젝트 단계별로 생산되는 문서 또는 소프트웨어 결과물 | REF-04 |
| G-11 | 서비스 공급망 | Service Supply Chain | SaaS 제공을 위한 외부 벤더·오픈소스·하드웨어 생태계 | REF-01 |
| G-12 | 소프트웨어 자재명세서 | SBOM | 소프트웨어 구성 요소 및 의존성을 열거한 인벤토리 문서 | REF-01 |
| G-13 | 수용 기준 | Acceptance Criteria | 요구사항이 충족되었음을 검증하는 명확한 합격/불합격 조건 | REF-04 |
| G-14 | 암호화 | Encryption | 데이터를 허가된 자만 해독 가능하도록 변환하는 기술 | REF-01 |
| G-15 | 역할 기반 접근 통제 | RBAC | 사용자 역할에 따라 시스템 자원 접근 권한을 부여하는 체계 | REF-01 |
| G-16 | 요구사항 정의서 | Requirements Definition | 사업 요구사항을 ID 체계로 정리한 감리 핵심 산출물 | REF-04 |
| G-17 | 위협 모델링 | Threat Modeling | 시스템 보안 위협을 체계적으로 식별·분석하는 활동 | REF-12 |
| G-18 | 인증 | Certification | 공인 기관이 보안 요건 충족 여부를 공식 확인하는 절차 | REF-01 |
| G-19 | 인프라 요구사항 | Infrastructure Requirement | 시스템 운영에 필요한 하드웨어·네트워크·클라우드 요건 | REF-04 |
| G-20 | 자가진단 | Self-Assessment | 외부 감사 전 내부적으로 규정 준수 여부를 점검하는 활동 | REF-01 |
| G-21 | 재해복구 | Disaster Recovery | 시스템 장애 또는 재해 발생 시 서비스를 복구하는 절차 | REF-01 |
| G-22 | 정보보호 정책 | Information Security Policy | 조직의 정보보호 목표·원칙·책임을 기술한 최상위 문서 | REF-01 |
| G-23 | 정보시스템 감리 | Information System Audit | 정보화사업 산출물의 품질·적합성을 전문가가 검토하는 행위 | REF-04 |
| G-24 | 최소 테스트 단위 | MTU | 독립 구현·즉시 검증·1~2세션 완료 가능한 최소 작업 단위 | — |
| G-25 | 추적성 매트릭스 | Traceability Matrix | 요구사항↔설계↔구현↔테스트 간 연결 관계를 표로 정리 | REF-04 |
| G-26 | 침해사고 | Security Incident | 시스템 기밀성·무결성·가용성을 훼손하는 보안 사건 | REF-01 |
| G-27 | 컨테이너 | Container | OS 수준 가상화 기술. 공공 SaaS에서는 k3s(Kubernetes) 활용 | — |
| G-28 | 통제 항목 | Control Item | 보안 목표 달성을 위해 구현해야 하는 개별 보안 요건 | REF-01 |
| G-29 | 특권 계정 | Privileged Account | 시스템 관리자 권한을 보유한 고위험 사용자 계정 | REF-01 |
| G-30 | 하네스 | Harness | Claude Code 에이전트 실행 환경 및 워크플로우 자동화 체계 | — |
| G-31 | 행정안전부 | MOIS | 전자정부·정보화사업·감리기준을 관장하는 중앙부처 | REF-04 |
| G-32 | 형상 관리 | Configuration Management | 소프트웨어 버전·변경 이력을 체계적으로 관리하는 활동 | REF-04 |

**약어 목록 섹션** (가나다/알파벳순):

| 약어 | 원문 | 한글 의미 |
|------|------|---------|
| AES | Advanced Encryption Standard | 미국 표준 대칭키 암호화 알고리즘 |
| API | Application Programming Interface | 응용 프로그램 프로그래밍 인터페이스 |
| CSAP | Cloud Security Assurance Program | 클라우드 보안 인증 프로그램 (KISA) |
| CI/CD | Continuous Integration/Continuous Delivery | 지속적 통합·배포 파이프라인 |
| ECC | Everything Claude Code | Claude Code 에이전트 SDK 기반 하네스 |
| FR | Functional Requirement | 기능 요구사항 |
| GitOps | Git Operations | Git 저장소를 단일 진실 원천으로 인프라 자동화 |
| IAM | Identity and Access Management | 신원·접근 관리 |
| INFR | Infrastructure Requirement | 인프라 요구사항 |
| ISMS-P | Information Security Management System - Personal | 정보보호 및 개인정보보호 관리체계 |
| JWT | JSON Web Token | JSON 기반 토큰 인증 표준 |
| k3s | Kubernetes (경량) | CNCF 인증 경량 쿠버네티스 배포판 |
| KISA | Korea Internet & Security Agency | 한국인터넷진흥원 |
| MCP | Model Context Protocol | Anthropic 제안 AI 에이전트 통신 프로토콜 |
| MOIS | Ministry of the Interior and Safety | 행정안전부 |
| MTU | Minimum Testable Unit | 최소 테스트 단위 |
| N2SF | National Network Security Framework | 국가정보보안 기본지침 체계 |
| NFR | Non-Functional Requirement | 비기능 요구사항 |
| NIS | National Intelligence Service | 국가정보원 |
| NIST | National Institute of Standards and Technology | 미국 국립표준기술연구소 |
| OSCAL | Open Security Controls Assessment Language | NIST 보안 통제 기계 판독 언어 |
| OWASP | Open Web Application Security Project | 웹 애플리케이션 보안 비영리 단체 |
| PII | Personally Identifiable Information | 개인 식별 가능 정보 |
| PDCA | Plan-Do-Check-Act | 계획-실행-점검-조치 품질 관리 사이클 |
| RBAC | Role-Based Access Control | 역할 기반 접근 통제 |
| SaaS | Software as a Service | 서비스형 소프트웨어 |
| SBOM | Software Bill of Materials | 소프트웨어 자재명세서 |
| TLS | Transport Layer Security | 전송 계층 보안 프로토콜 |
| WSL2 | Windows Subsystem for Linux 2 | Windows용 Linux 서브시스템 2세대 |
| XSS | Cross-Site Scripting | 교차 사이트 스크립팅 보안 취약점 |

---

## 합격 기준 (Acceptance Criteria)

1. 외부 규정 링크 12개 이상 수록 (REF-01 ~ REF-12 전수)
2. 각 규정에 발행 기관·최신 버전·URL·프레임워크 적용 영역 4개 필드 완비
3. 용어 정의 32개 이상 (G-01 ~ G-32), 각 항목에 영문 표기·정의·관련 규정 포함
4. 약어 목록 30개 이상, 원문 및 한글 의미 완비
5. regulations-index.md에서 각 MTU가 참조하는 규정 역추적 가능
6. 변경 이력 섹션 존재 (규정 개정 시 추적 가능)

---

## 테스트 시나리오

**TS-F2-01**: 신규 개발자가 "N2SF가 무엇인가"를 glossary-and-acronyms.md에서 30초 이내 찾을 수 있음

**TS-F2-02**: MTU-C1 작성자가 regulations-index.md에서 CSAP 표준등급 원문 URL을 1분 이내 확인 가능

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 — 12개 규정·32개 용어·30개 약어 설계 | Claude Code |
