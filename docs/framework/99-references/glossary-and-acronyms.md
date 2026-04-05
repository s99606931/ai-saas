# 용어 정의 및 약어 사전

| 항목 | 내용 |
|------|------|
| 문서 ID | REF-GLOSSARY |
| 버전 | 0.1.0 |
| 최종 수정일 | 2026-04-05 |
| 용어 수 | 35개 (G-01 ~ G-35) |
| 약어 수 | 35개 |
| FR 매핑 | FR-0.5 (용어/약어 정의 완비) |

<!-- Design Ref: MTU-F2-references.design.md 3.2절 -- 참조형 설계 -->

---

## 1. 적용 범위 및 목적

본 문서는 공공기관 SaaS 프레임워크에서 사용하는 모든 용어와 약어의 **단일 정의 출처**입니다.

프레임워크 내 문서에서 전문 용어를 최초 사용할 때 본 문서의 `G-XX` 번호를 병기할 수 있습니다. 용어 정의가 불분명하거나 동일 용어의 의미가 상충할 때 본 문서의 정의를 표준으로 적용합니다.

---

## 2. 용어 정의 (가나다순)

| 번호 | 한글 용어 | 영문 표기 | 정의 | 관련 규정 |
|------|---------|---------|------|---------|
| G-01 | 감리 | IT Audit | 정보화사업의 품질, 적합성, 완결성을 제3자가 독립적으로 확인하는 행위. 행정안전부 고시에 따라 착수/분석/설계/구현/시험 5단계로 수행 | REF-04 |
| G-02 | 감사 로그 | Audit Log | 시스템에서 발생한 보안 관련 이벤트를 시간 순서대로 기록한 변경 불가(append-only) 저장소. CSAP D-06 필수 요건 | REF-01 |
| G-03 | 공공 SaaS | Public SaaS | 공공기관이 사용하는 Software as a Service 형태의 클라우드 서비스. CSAP 인증 또는 보안적합성 검증 필요 | REF-07 |
| G-04 | 국가 망 보안체계 | N2SF (National Network Security Framework) | 국가정보원이 발행하는 국가 정보통신망 보안 분류 및 통제 체계. 업무 중요도에 따라 기밀(C), 민감(S), 공개(O) 3등급 분류 후 6개 보안통제 항목을 차등 적용 | REF-03 |
| G-05 | 기능 요구사항 | Functional Requirement (FR) | 시스템이 수행해야 하는 기능적 동작을 명시한 요건. `FR-X.Y` 형식의 ID 체계로 관리 | REF-04 |
| G-06 | 데이터 분류 등급 | Data Classification Level | N2SF에 따른 기밀(Classified, C), 민감(Sensitive, S), 공개(Open, O) 3등급 분류 체계. AI API 전송 시 C/S등급은 절대 금지 | REF-03 |
| G-07 | 매핑 테이블 | Mapping Table | 두 체계(예: CSAP와 N2SF) 간 항목 대응 관계를 표로 정리한 문서. 추적성 보장의 핵심 도구 | -- |
| G-08 | 비기능 요구사항 | Non-Functional Requirement (NFR) | 성능, 보안, 가용성, 유지보수성 등 기능 외 시스템 속성 요건 | REF-04 |
| G-09 | 사업계획서 | Business Plan | 정보화사업 착수 시 제출하는 사업 목적, 범위, 예산, 일정, 보안 계획 문서. 감리 T01 산출물 | REF-04 |
| G-10 | 산출물 | Deliverable | 프로젝트 단계별로 생산되는 문서 또는 소프트웨어 결과물. 감리 시 제출 대상 | REF-04 |
| G-11 | 서비스 공급망 | Service Supply Chain | SaaS 제공을 위한 외부 벤더, 오픈소스, 하드웨어 등 전체 의존성 생태계. SBOM으로 관리 | REF-01 |
| G-12 | 소프트웨어 자재명세서 | SBOM (Software Bill of Materials) | 소프트웨어를 구성하는 모든 요소(라이브러리, 프레임워크, 도구)와 의존성을 열거한 인벤토리 문서. 공급망 보안의 핵심 | REF-01 |
| G-13 | 수용 기준 | Acceptance Criteria | 요구사항이 충족되었음을 검증하는 명확한 합격/불합격 조건. 감리 시 판정 근거 | REF-04 |
| G-14 | 암호화 | Encryption | 데이터를 허가된 자만 해독 가능하도록 변환하는 기술. CSAP D-09 요건: 저장 시 AES-256, 전송 시 TLS 1.3+ | REF-01 |
| G-15 | 역할 기반 접근 통제 | RBAC (Role-Based Access Control) | 사용자 역할에 따라 시스템 자원 접근 권한을 부여하는 체계. CSAP D-08 핵심 요건 | REF-01 |
| G-16 | 요구사항 정의서 | Requirements Definition | 사업 요구사항을 FR/NFR ID 체계로 정리한 감리 핵심 산출물. 감리 T02에 해당 | REF-04 |
| G-17 | 위협 모델링 | Threat Modeling | 시스템의 보안 위협을 체계적으로 식별, 분석, 대응 방안을 수립하는 활동 | REF-12 |
| G-18 | 인증 | Certification | 공인 기관(KISA 등)이 보안 요건 충족 여부를 공식적으로 확인하는 절차. CSAP, ISMS-P 등 | REF-01 |
| G-19 | 인프라 요구사항 | Infrastructure Requirement (INFR) | 시스템 운영에 필요한 하드웨어, 네트워크, 클라우드 환경 요건 | REF-04 |
| G-20 | 자가진단 | Self-Assessment | 외부 감사 전 내부적으로 규정 준수 여부를 점검하는 활동. CSAP 체크리스트 기반 수행 | REF-01 |
| G-21 | 재해복구 | Disaster Recovery (DR) | 시스템 장애 또는 재해 발생 시 서비스를 복구하는 절차. RTO/RPO 기반 복구 목표 설정 필수 | REF-01 |
| G-22 | 정보보호 정책 | Information Security Policy | 조직의 정보보호 목표, 원칙, 책임을 기술한 최상위 문서. CSAP D-01 필수 산출물 | REF-01 |
| G-23 | 정보시스템 감리 | Information System Audit | 정보화사업 산출물의 품질, 적합성을 전문 감리법인이 검토하는 행위. 5단계(착수/분석/설계/구현/시험) | REF-04 |
| G-24 | 최소 테스트 단위 | MTU (Minimum Testable Unit) | 독립 구현, 즉시 검증, 1~2세션 완료 가능한 최소 작업 단위. 본 프레임워크의 작업 분할 기준 | -- |
| G-25 | 추적성 매트릭스 | Traceability Matrix | 요구사항(FR) <-> 설계 <-> 구현 <-> 테스트 <-> CSAP 통제항목 간 연결 관계를 표로 정리한 문서. 감리 핵심 증거 | REF-04 |
| G-26 | 침해사고 | Security Incident | 시스템의 기밀성, 무결성, 가용성을 훼손하는 보안 사건. CSAP D-06에 따라 탐지-격리-복구-보고 절차 수행 | REF-01 |
| G-27 | 컨테이너 | Container | OS 수준 가상화 기술로 애플리케이션을 격리 실행하는 단위. 본 프레임워크에서는 k3s(경량 Kubernetes)를 활용 | -- |
| G-28 | 통제 항목 | Control Item | 보안 목표 달성을 위해 구현해야 하는 개별 보안 요건. CSAP 79개 / N2SF 260여개 | REF-01 |
| G-29 | 특권 계정 | Privileged Account | 시스템 관리자 권한을 보유한 고위험 사용자 계정. 분리 관리 및 사용 이력 전수 기록 필요 | REF-01 |
| G-30 | 하네스 | Harness | Claude Code 에이전트 실행 환경 및 워크플로우 자동화 체계. 5개 에이전트 + 7단계 Q-Gate로 구성 | -- |
| G-31 | 행정안전부 | MOIS (Ministry of the Interior and Safety) | 전자정부, 정보화사업, 감리기준을 관장하는 대한민국 중앙행정기관 | REF-04 |
| G-32 | 형상 관리 | Configuration Management (CM) | 소프트웨어 버전, 변경 이력을 체계적으로 관리하는 활동. Gitea + GitOps 기반 수행 | REF-04 |
| G-33 | 보안적합성 검증 | Security Conformity Verification | 국가정보원이 수행하는 정보보호 제품의 보안 기능 적합성 확인 절차. 2026년부터 CSAP 없이 이 검증만으로 공공 진출 가능 예정 | REF-14 |
| G-34 | 예비심사 | Preliminary Audit | ISMS-P 본심사 전 핵심 항목을 사전 점검하는 신규 제도. 2026년 ISMS-P 개편으로 도입 예정 | REF-05 |
| G-35 | 보안통제 항목 | Security Control Item | N2SF에서 정의하는 C/S/O 등급별 차등 적용 보안 대책 항목. v1.0 기준 6개 영역(권한, 인증, 분리/격리, 통제, 데이터, 정보자산) 260여개 | REF-03 |

---

## 3. 약어 목록 (알파벳순)

| 약어 | 원문 | 한글 의미 |
|------|------|---------|
| AES | Advanced Encryption Standard | 미국 표준 대칭키 암호화 알고리즘 (AES-256 사용) |
| API | Application Programming Interface | 응용 프로그램 프로그래밍 인터페이스 |
| CC | Claude Code | Anthropic의 AI 에이전트 기반 개발 환경 |
| CI/CD | Continuous Integration / Continuous Delivery | 지속적 통합 및 배포 파이프라인 |
| CM | Configuration Management | 형상 관리 (G-32) |
| CSAP | Cloud Security Assurance Program | 클라우드서비스 보안인증제 (KISA 운영) |
| CSK | Cyber Summit Korea | 글로벌 사이버안보 행사 (국가정보원 주관) |
| DR | Disaster Recovery | 재해복구 (G-21) |
| ECC | Everything Claude Code | Claude Code 에이전트 SDK 기반 하네스 프레임워크 |
| FR | Functional Requirement | 기능 요구사항 (G-05) |
| GGUF | GPT-Generated Unified Format | 경량 LLM 모델 배포 형식 (LM Studio 사용) |
| GitOps | Git Operations | Git 저장소를 단일 진실 원천(Single Source of Truth)으로 활용하는 인프라 자동화 방법론 |
| IAM | Identity and Access Management | 신원 및 접근 관리 체계 |
| INFR | Infrastructure Requirement | 인프라 요구사항 (G-19) |
| ISMS-P | Information Security Management System - Personal Information | 정보보호 및 개인정보보호 관리체계 인증 (2027-07 의무화 확정) |
| JWT | JSON Web Token | JSON 기반 토큰 인증 표준 (접근 15분, 갱신 7일 정책) |
| k3s | Kubernetes (Lightweight) | CNCF 인증 경량 쿠버네티스 배포판 (Rancher Labs) |
| KISA | Korea Internet & Security Agency | 한국인터넷진흥원 (CSAP, ISMS-P 운영) |
| MCP | Model Context Protocol | Anthropic 제안 AI 에이전트 통신 프로토콜 |
| MOIS | Ministry of the Interior and Safety | 행정안전부 (G-31) |
| MTU | Minimum Testable Unit | 최소 테스트 단위 (G-24) |
| N2SF | National Network Security Framework | 국가 망 보안체계 (G-04) |
| NFR | Non-Functional Requirement | 비기능 요구사항 (G-08) |
| NIS | National Intelligence Service | 국가정보원 (N2SF 주관) |
| NIST | National Institute of Standards and Technology | 미국 국립표준기술연구소 |
| OPA | Open Policy Agent | CNCF 범용 정책 엔진 (Kubernetes 정책 적용) |
| OSCAL | Open Security Controls Assessment Language | NIST 보안 통제 기계 판독 언어 |
| OTel | OpenTelemetry | CNCF 관찰성(Observability) 표준 프레임워크 |
| OWASP | Open Web Application Security Project | 웹 애플리케이션 보안 비영리 단체 (Top 10 발행) |
| PDCA | Plan-Do-Check-Act | 계획-실행-점검-조치 품질 관리 사이클 |
| PII | Personally Identifiable Information | 개인 식별 가능 정보 (마스킹 필수) |
| RBAC | Role-Based Access Control | 역할 기반 접근 통제 (G-15) |
| RTO/RPO | Recovery Time Objective / Recovery Point Objective | 복구 목표 시간 / 복구 목표 시점 |
| SaaS | Software as a Service | 서비스형 소프트웨어 |
| SBOM | Software Bill of Materials | 소프트웨어 자재명세서 (G-12) |
| TLS | Transport Layer Security | 전송 계층 보안 프로토콜 (1.3+ 필수) |
| WSL2 | Windows Subsystem for Linux 2 | Windows용 Linux 서브시스템 2세대 |
| XSS | Cross-Site Scripting | 교차 사이트 스크립팅 보안 취약점 |

---

## 4. 용어 사용 지침

### 4.1 문서 작성 시 규칙

1. **최초 사용 시**: 한글 용어 뒤에 영문 약어를 괄호로 병기합니다.
   - 예: "역할 기반 접근 통제(RBAC)를 적용합니다"
2. **이후 사용 시**: 약어만 사용 가능합니다.
   - 예: "RBAC 정책에 따라..."
3. **정의 충돌 시**: 본 문서의 정의가 표준입니다.
4. **신규 용어 추가 시**: 본 문서에 먼저 등록 후 다른 문서에서 사용합니다.

### 4.2 공공기관 용어 선호 규칙

| 지양 (비표준) | 선호 (표준) | 근거 |
|-------------|-----------|------|
| 보안 감사 | 감리 | REF-04 (행안부 공식 용어) |
| 클라우드 인증 | CSAP 인증 | REF-01 (KISA 공식 용어) |
| 망분리 | N2SF 등급 분류 | REF-03 (2026 신규 체계) |
| 개인정보 인증 | ISMS-P 인증 | REF-05 (KISA 공식 용어) |
| 서버리스 | 컨테이너 기반 (k3s) | 본 프레임워크 기준 |

---

## 5. 관련 문서 참조

본 문서는 프레임워크 최하위 기반 레이어로서, 다른 문서를 참조하지 않습니다.
다른 모든 문서가 본 문서를 참조합니다.

---

## 6. 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 0.1.0 | 2026-04-05 | 최초 작성 -- 용어 35개(G-01~G-35), 약어 35개. 2026 최신 용어 반영 (보안적합성 검증, 예비심사, 보안통제 항목) | Claude Code (PM Lead) |
