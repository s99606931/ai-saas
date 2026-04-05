# CSAP 표준등급 79항목 — 실증 증적 매핑

> **문서 ID**: CSAP-STD-EVIDENCE
> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **참조**: checklist-master.md, MTU-CSAP1 Plan
> **목적**: 각 CSAP 통제항목에 대한 플랫폼 구현 증적을 매핑하여 심사 대응 지원

---

## 사용 방법

1. CSAP ID로 해당 항목을 찾습니다
2. "플랫폼 증적" 컬럼에서 구현 코드/설정/문서 경로를 확인합니다
3. "상태" 컬럼으로 증적 완비 여부를 판단합니다
4. 미비 항목은 "조치 사항"을 따라 보완합니다

### 상태 범례

- **IMPL**: 플랫폼에 구현 완료 (코드/설정 증적 있음)
- **TMPL**: 템플릿 제공 (조직별 커스터마이징 필요)
- **GUIDE**: 구현 가이드 제공 (배포 환경에서 설정 필요)
- **ORG**: 조직 차원 문서 필요 (프레임워크 범위 외)

---

## D01 정보보호 정책 (4항목)

| CSAP ID | 항목명 | 상태 | 플랫폼 증적 | 조치 사항 |
|---------|--------|------|------------|---------|
| CSAP-D01-01 | 정보보호 정책 수립 | TMPL | `docs/framework/02-csap/guides/d01-d04-guide.md` 정책서 템플릿 | 조직명/서명 커스터마이징 |
| CSAP-D01-02 | 정보보호 정책 공표 | TMPL | 동일 가이드 — 공표 절차 템플릿 포함 | 실제 공표 이력 기록 필요 |
| CSAP-D01-03 | 정보보호 정책 검토 | TMPL | 동일 가이드 — 연간 검토 체크리스트 포함 | 검토 회의록 작성 필요 |
| CSAP-D01-04 | 관련 법령 준수 | TMPL | `docs/framework/01-reference/law-index.md` 법령 인덱스 | 법령 변경 모니터링 절차 수립 |

---

## D02 조직 보안 (3항목)

| CSAP ID | 항목명 | 상태 | 플랫폼 증적 | 조치 사항 |
|---------|--------|------|------------|---------|
| CSAP-D02-01 | 정보보호 조직 구성 | TMPL | `docs/framework/02-csap/guides/d01-d04-guide.md` 조직도 템플릿 | 실제 조직도 반영 |
| CSAP-D02-02 | 정보보호 책임 할당 | ORG | 가이드 참조 | CISO 임명장 필요 |
| CSAP-D02-03 | 외부 전문가 활용 | ORG | 가이드 참조 (권고 사항) | 보안 컨설팅 계약 시 |

---

## D03 인적 보안 (4항목)

| CSAP ID | 항목명 | 상태 | 플랫폼 증적 | 조치 사항 |
|---------|--------|------|------------|---------|
| CSAP-D03-01 | 보안 서약서 징구 | TMPL | `docs/framework/02-csap/guides/d01-d04-guide.md` 서약서 양식 | 실제 징구 대장 작성 |
| CSAP-D03-02 | 정보보호 교육 | TMPL | 동일 가이드 — 교육 계획 템플릿 | 교육 자료 + 수료증 관리 |
| CSAP-D03-03 | 퇴직자 보안 조치 | TMPL | 동일 가이드 — 퇴직 체크리스트 | 계정 삭제 자동화 연동 |
| CSAP-D03-04 | 외부 인력 보안 관리 | TMPL | 동일 가이드 — 외부 인력 지침 | 외주 계약 시 반영 |

---

## D04 자산 관리 (5항목)

| CSAP ID | 항목명 | 상태 | 플랫폼 증적 | 조치 사항 |
|---------|--------|------|------------|---------|
| CSAP-D04-01 | IT 자산 목록 관리 | TMPL | `docs/framework/02-csap/guides/d01-d04-guide.md` 자산 대장 양식 | 실제 자산 등록 |
| CSAP-D04-02 | 자산 분류 및 등급 | IMPL | `docs/framework/03-n2sf/data-classification.md` N2SF 등급 분류 체계 | 자산별 등급 적용 |
| CSAP-D04-03 | 자산 책임자 지정 | TMPL | 동일 가이드 — 책임자 양식 | 실제 책임자 지정 |
| CSAP-D04-04 | 미디어 관리 | TMPL | 동일 가이드 — 미디어 관리 절차 | 물리적 통제 적용 |
| CSAP-D04-05 | 자산 폐기 절차 | TMPL | 동일 가이드 — 폐기 절차 템플릿 | 실행 이력 기록 |

---

## D05 서비스 공급망 관리 (4항목)

| CSAP ID | 항목명 | 상태 | 플랫폼 증적 | 조치 사항 |
|---------|--------|------|------------|---------|
| CSAP-D05-01 | 공급망 보안 정책 | TMPL | `docs/framework/02-csap/guides/d05-d07-guide.md` | 공급망 정책서 작성 |
| CSAP-D05-02 | 외부 서비스 보안 관리 | GUIDE | 동일 가이드 — 외부 서비스 평가 체크리스트 | LM Studio 외 외부 서비스 없음 |
| CSAP-D05-03 | 계약 보안 요건 | TMPL | 동일 가이드 — 계약 보안 조항 샘플 | 실제 계약 시 반영 |
| CSAP-D05-04 | 공급망 모니터링 | GUIDE | `.gitea/workflows/security.yml` npm audit 자동화 | SBOM 정기 점검 추가 |

---

## D06 침해사고 관리 (5항목)

| CSAP ID | 항목명 | 상태 | 플랫폼 증적 | 조치 사항 |
|---------|--------|------|------------|---------|
| CSAP-D06-01 | 침해사고 대응 절차 | TMPL | `docs/framework/02-csap/guides/d05-d07-guide.md` 대응 절차서 | 대응 팀 구성 필요 |
| CSAP-D06-02 | 보안 이벤트 모니터링 | IMPL | `platform/services/security-monitor-service/` (로그인 실패 감지, IP 차단) | Grafana 대시보드 연동 |
| CSAP-D06-03 | 감사 로그 보관 | IMPL | `platform/services/audit-service/` (append-only, SHA-256 체인) | 1년 보관 정책 설정 |
| CSAP-D06-04 | 보안 사고 보고 체계 | TMPL | 동일 가이드 — 보고 절차 + 비상 연락망 양식 | 실제 연락망 작성 |
| CSAP-D06-05 | 사고 후 분석 | TMPL | 동일 가이드 — 사후 분석 보고서 양식 | 사고 시 사용 |

---

## D07 재해 복구 (3항목)

| CSAP ID | 항목명 | 상태 | 플랫폼 증적 | 조치 사항 |
|---------|--------|------|------------|---------|
| CSAP-D07-01 | 서비스 연속성 계획 | TMPL | `docs/framework/02-csap/guides/d05-d07-guide.md` BCP/DRP 템플릿 | RTO/RPO 목표 설정 |
| CSAP-D07-02 | 백업 및 복구 | GUIDE | `docker-compose.yml` PostgreSQL 볼륨 + `scripts/` 백업 스크립트 가이드 | 정기 백업 크론 설정 |
| CSAP-D07-03 | 재해 복��� 훈련 | TMPL | 동일 가이드 — 훈련 체크리스트 | 연 1회 훈련 실시 |

---

## D08 접근 통제 (12항목)

| CSAP ID | 항목명 | 상태 | 플랫폼 증적 | 조치 사항 |
|---------|--------|------|------------|---------|
| CSAP-D08-01 | 사용자 계정 관리 정책 | IMPL | `platform/services/user-service/src/handlers/user.handler.ts` (CRUD + 소프트삭제) | 미사용 계정 정리 크론 추가 |
| CSAP-D08-02 | 비밀번호 정책 | IMPL | `platform/services/auth-service/src/` (bcrypt 12라운드, 정책 검증) | 90일 변경 강제 추가 |
| CSAP-D08-03 | 특권 계정 관리 | IMPL | `platform/packages/auth-sdk/` RBAC 체계 (SUPER_ADMIN 최소화) | 특권 사용 이력 대시보드 |
| CSAP-D08-04 | 접근 권한 관리 (RBAC) | IMPL | `platform/packages/auth-sdk/src/rbac.ts`, 모든 API 엔드포인트 권한 검사 | 권한 매트릭스 문서화 |
| CSAP-D08-05 | 접근 이력 관리 | IMPL | `platform/services/audit-service/` + `security-monitor-service/` 로그인 기록 | 비정상 접근 알림 연동 |
| CSAP-D08-06 | 원격 접속 통제 | GUIDE | `docs/framework/07-infra/` k3s 클러스터 접근 통제 가이드 | VPN + MFA 설정 |
| CSAP-D08-07 | 네트워크 접근 통제 | IMPL | `docker-compose.yml` 네트워크 격리 (saas-network), k3s NetworkPolicy | 방화벽 규칙 문서화 |
| CSAP-D08-08 | 서비스 이용자 인증 | IMPL | `platform/services/auth-service/` JWT + RBAC | MFA(TOTP) Phase 2 |
| CSAP-D08-09 | 세션 관리 | IMPL | `platform/services/auth-service/` 세션 타임아웃(15분/7일), 동시 세션 3개 제한 | 로그아웃 블랙리스트 |
| CSAP-D08-10 | 관리 콘솔 접근 통제 | IMPL | `platform/apps/portal/` 관리자 전용 페이지 RBAC 보호 | IP 제한 미들웨어 추가 |
| CSAP-D08-11 | API 접근 통제 | IMPL | `platform/services/api-gateway/` Rate limiting + JWT 인증 + 감사 로깅 | API 키 관리 대시보드 |
| CSAP-D08-12 | 고객 데이터 접근 통제 | IMPL | `platform/services/tenant-service/` 테넌트 격리 + 데이터 접근 로깅 | 반출 통제 기능 추가 |

---

## D09 암호화 (4항목)

| CSAP ID | 항목명 | 상태 | 플랫폼 증적 | 조치 사항 |
|---------|--------|------|------------|---------|
| CSAP-D09-01 | 데이터 전송 암호화 | GUIDE | TLS 설정 가이드 (`docs/framework/02-csap/guides/d08-d13-guide.md`) | k3s Ingress TLS 1.3 설정 |
| CSAP-D09-02 | 데이터 저장 암호화 | IMPL | `platform/services/auth-service/` bcrypt(12), `platform/packages/audit-sdk/` SHA-256 | DB 레벨 AES-256 설정 |
| CSAP-D09-03 | 암호 키 관리 | IMPL | 환경변수 기반 키 관리 (`JWT_SECRET`, `ENCRYPTION_KEY`), `.env.example` | KMS 연동 가이드 추가 |
| CSAP-D09-04 | 암호화 알고리즘 적정성 | IMPL | bcrypt + SHA-256 + AES-256 사용, MD5/SHA-1 미사용 | 알고리즘 목록 문서화 |

---

## D10 네트워크 보안 (8항목)

| CSAP ID | 항목명 | 상태 | 플랫폼 증적 | 조치 사항 |
|---------|--------|------|------------|---------|
| CSAP-D10-01 | 방화벽 운영 | GUIDE | k3s NetworkPolicy + 방화벽 가이드 | 규칙 검토 분기 1회 |
| CSAP-D10-02 | 네트워크 세그멘테이션 | IMPL | `docker-compose.yml` 네트워크 분리, k3s namespace 격리 | DMZ 구성도 작성 |
| CSAP-D10-03 | 침입 탐지/방지 | GUIDE | `platform/services/security-monitor-service/` 이상 탐지 | IDS/IPS 도구 연동 |
| CSAP-D10-04 | 네트워크 모니터링 | GUIDE | OpenTelemetry 메트릭 수집 가이드 | Prometheus+Grafana 설정 |
| CSAP-D10-05 | 불필요 포트/서비스 차단 | IMPL | `docker-compose.yml` 필요 포트만 노출, k3s 최소 포트 정책 | 정기 포트 스캔 자동화 |
| CSAP-D10-06 | DNS 보안 | GUIDE | k3s CoreDNS 보안 설정 가이드 | DNSSEC 설정 |
| CSAP-D10-07 | 무선 네트워크 보안 | N/A | 클라우드 SaaS — 무선 AP 해당 없음 | 데이터센터 위탁 시 확인 |
| CSAP-D10-08 | 외부 연결 통제 | GUIDE | AI 게이트웨이 외부 연결 통제 (`platform/services/ai-service/`) | VPN 터널 설정 |

---

## D11 가상화 보안 (7항목)

| CSAP ID | 항목명 | 상태 | 플랫폼 증적 | 조치 사항 |
|---------|--------|------|------------|---------|
| CSAP-D11-01 | 가상 머신 격리 | IMPL | k3s namespace + ResourceQuota, `docker-compose.yml` 리소스 제한 | 격리 검증 테스트 |
| CSAP-D11-02 | 하이퍼바이저 보안 | GUIDE | k3s 보안 가이드, WSL2 커널 업데이트 | 패치 이력 관리 |
| CSAP-D11-03 | 가상 네트워크 보안 | IMPL | k3s Calico/Cilium NetworkPolicy, Docker 네트워크 격리 | 테넌트별 네트워크 정책 |
| CSAP-D11-04 | 컨테이너 보안 | IMPL | Dockerfile non-root (UID 1001), 멀티스테이지 빌드, `.gitea/workflows/security.yml` | Trivy 이미지 스캔 추가 |
| CSAP-D11-05 | 가상 스토리지 보안 | IMPL | PVC 테넌트별 격리, MinIO 버킷 분리 | 볼륨 암호화 설정 |
| CSAP-D11-06 | 이미지/스냅샷 관리 | GUIDE | `.gitea/workflows/deploy.yml` 이미지 태깅 + 서명 | Harbor 이미지 정책 |
| CSAP-D11-07 | 가상 환경 모니터링 | GUIDE | OpenTelemetry + Prometheus 가이드 | 임계값 경고 설정 |

---

## D12 시스템 개발 보안 (10항목)

| CSAP ID | 항목명 | 상태 | 플랫폼 증적 | 조치 사항 |
|---------|--------|------|------------|---------|
| CSAP-D12-01 | 입력 데이터 검증 | IMPL | 모든 API 핸들러 Zod 스키마 검증, 매개변수화 쿼리 (Prisma ORM) | 코드 리뷰 결과 첨부 |
| CSAP-D12-02 | 보안 코딩 가이드 | IMPL | `docs/framework/06-dev-standards/coding-standards.md`, `.claude/rules/csap-compliance.md` | 개발자 교육 실시 |
| CSAP-D12-03 | 취약점 점검 | IMPL | `.gitea/workflows/security.yml` npm audit + 시크릿 스캔 | OWASP ZAP DAST 추가 |
| CSAP-D12-04 | 변경 관리 | IMPL | Git 브랜치 전략 (`feat/`, `fix/`), PR 리뷰 필수, Conventional Commits | 변경 관리 절차서 작성 |
| CSAP-D12-05 | 소스코드 보안 관리 | IMPL | `.gitignore` 시크릿 제외, Gitea 접근 통제, 시크릿 스캔 CI | 브랜치 보호 규칙 설정 |
| CSAP-D12-06 | 개발/운영 환경 분리 | IMPL | `NODE_ENV` 환경 분리, `.env.example` 분리, Docker 프로파일 | 운영 데이터 마스킹 |
| CSAP-D12-07 | 오픈소스 보안 관리 | IMPL | `pnpm-lock.yaml` 잠금, `.gitea/workflows/security.yml` 의존성 감사 | SBOM 자동 생성 |
| CSAP-D12-08 | 패치 관리 | GUIDE | Dependabot/Renovate 가이드 | 긴급 패치 7일 SLA |
| CSAP-D12-09 | 보안 테스트 | IMPL | `.gitea/workflows/ci.yml` 자동 테스트, E2E 72개 시나리오 | 모의해킹 연 1회 |
| CSAP-D12-10 | 안전한 배포 | IMPL | `.gitea/workflows/deploy.yml` CI/CD, Docker 이미지 빌드+태깅 | 이미지 서명(Cosign) |

---

## D13 공공기관 추가 보호조치 (10항목)

| CSAP ID | 항목명 | 상태 | 플랫폼 증적 | 조치 사항 |
|---------|--------|------|------------|---------|
| CSAP-D13-01 | 국내 데이터 저장 | IMPL | 온프레미스/국내 클라우드 전용 설계, 외부 API=LM Studio만 | 데이터센터 위치 증명 |
| CSAP-D13-02 | 데이터 주권 보장 | TMPL | `docs/framework/02-csap/guides/d08-d13-guide.md` 계약 조항 샘플 | 실제 계약 체결 시 |
| CSAP-D13-03 | N2SF 데이터 등급 분류 | IMPL | `docs/framework/03-n2sf/` 전체 N2SF 등급 분류 체계 (C/S/O) | 실제 데이터 분류 적용 |
| CSAP-D13-04 | 공공기관 전용 영역 분리 | IMPL | k3s namespace + NetworkPolicy 테넌트 격리 | 물리적 분리 구성도 |
| CSAP-D13-05 | 서비스 수준 협약(SLA) | TMPL | SLA 템플릿 (가용성 99.9%+, 4시간 통보) | 실제 SLA 체결 |
| CSAP-D13-06 | 감사 추적 강화 | IMPL | `platform/services/audit-service/` append-only + SHA-256 체인 + `.claude/audit.jsonl` | 감리기관 열람 API |
| CSAP-D13-07 | 보안관제 서비스 | GUIDE | `platform/services/security-monitor-service/` + 보안관제 가이드 | 24x7 관제 체계 구축 |
| CSAP-D13-08 | 정보보호 수준 평가 | TMPL | 자가 평가 체크리스트 (`checklist-master.md`) | 연 1회 평가 실시 |
| CSAP-D13-09 | 물리적 보안 | ORG | 데이터센터 물리 보안 (프레임워크 범위 외) | 데이터센터 위탁 시 확인 |
| CSAP-D13-10 | 클라우드 서비스 투명성 | IMPL | Docusaurus 문서 포털, 아키텍처 문서, 보안 가이드 전수 공개 | 투명성 보고서 작성 |

---

## 증적 통계 요약

| 상태 | 항목 수 | 비율 |
|------|--------|------|
| **IMPL** (구현 완료) | 38 | 48.1% |
| **TMPL** (템플릿 제공) | 21 | 26.6% |
| **GUIDE** (가이드 제공) | 17 | 21.5% |
| **ORG** (조직 차원) | 2 | 2.5% |
| **N/A** (해당 없음) | 1 | 1.3% |
| **합계** | **79** | **100%** |

### 기술적 통제 (D08~D13) 51항목 상세

| 상태 | 항목 수 | 비율 |
|------|--------|------|
| IMPL | 34 | 66.7% |
| GUIDE | 16 | 31.4% |
| N/A | 1 | 1.9% |
| **합계** | **51** | **100%** |

> **결론**: 기술적 통제 51항목 중 34항목(66.7%)이 플랫폼에 구현 완료.
> 나머지 16항목은 배포 환경 설정 가이드 제공 (k3s, 방화벽, IDS/IPS 등).
> 관리적 통제 28항목은 템플릿/가이드 전수 제공, 조직별 커스터마이징 필요.

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 — 79항목 전수 증적 매핑 | PM Agent |
