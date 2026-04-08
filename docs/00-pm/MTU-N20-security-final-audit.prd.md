# MTU-N20: 보안 최종 점검 PRD

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N20 |
| Phase | Phase 7 New (보안) |
| 버전 | 1.0.0 |
| 상태 | Approved |
| 작성일 | 2026-04-08 |
| 작성자 | PM Lead Agent (Claude Opus) |
| 복잡도 | MED |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | 53개 MTU 구현 완료 후 v1.0.0 릴리스 전 최종 보안 점검. CSAP D-12(시스템 개발 보안) 요건상 릴리스 전 취약점 점검 + 동적 분석이 필수. security-audit.sh 스크립트가 이미 존재하나, 실행 결과 분석 가이드 및 CI/CD 통합 절차가 부재 |
| **WHO** | 보안 담당자, 감리 위원, 운영 담당자 |
| **RISK** | (1) Trivy 미설치 시 스캔 불가, (2) OWASP ZAP 대상 서비스 미기동 시 Full Scan 불가, (3) HIGH 취약점 발견 시 릴리스 차단 |
| **SUCCESS** | (1) Trivy 컨테이너 이미지 스캔 절차 + 결과 해석 가이드, (2) OWASP ZAP 동적 분석 실행 절차, (3) npm/pnpm audit 결과 분석 절차, (4) 보안 점검 결과 보고서 템플릿, (5) CI/CD 보안 파이프라인 통합 가이드 |
| **SCOPE** | 보안 점검 가이드 문서 (기존 security-audit.sh 확장, Trivy 이미지 스캔 추가) |

---

## 시장조사 결과 반영

### Trivy 2026 현황
- Trivy: OS 패키지, 언어 의존성, IaC 설정, 시크릿, 라이선스 통합 스캔
- SBOM 생성 (CycloneDX, SPDX) -- MTU-C8과 연동
- 컨테이너 이미지 + 파일시스템 + k8s 클러스터 스캔 지원
- 출처: [Trivy 2026](https://appsecsanta.com/trivy), [Trivy Container Image](https://trivy.dev/docs/latest/guide/target/container_image/)

### OWASP ZAP 2026 현황
- 2024년 Linux Foundation으로 이전, "ZAP by Checkmarx" 리브랜딩
- OpenAPI/GraphQL 스키마 기반 API 보안 테스트 지원
- Docker 이미지로 CI/CD 파이프라인 통합 용이
- SQL Injection, XSS, 인증 취약점, API 설정 오류 탐지
- 출처: [OWASP ZAP Tutorial 2026](https://www.stationx.net/owasp-zap-tutorial/), [ZAP API Security](https://oneuptime.com/blog/post/2026-01-25-owasp-zap-api-security/view)

---

## 기능 요구사항

| FR ID | 요구사항 | 산출물 |
|-------|---------|--------|
| FR-N20.1 | Trivy 컨테이너 이미지 스캔 절차 + 결과 해석 가이드 | docs/security/trivy-image-scan-guide.md |
| FR-N20.2 | OWASP ZAP 동적 분석 실행 절차 | docs/security/owasp-zap-dast-guide.md |
| FR-N20.3 | 의존성 보안 감사 (pnpm audit) 결과 분석 절차 | docs/security/dependency-audit-guide.md |
| FR-N20.4 | 보안 점검 결과 보고서 템플릿 | docs/security/audit-report-template.md |
| FR-N20.5 | CI/CD 보안 파이프라인 통합 가이드 (Gitea Actions) | docs/security/cicd-security-pipeline.md |

---

## CSAP 매핑

| CSAP 항목 | 요구사항 | FR 매핑 |
|-----------|---------|---------|
| D-12-01 | 개발 보안 점검 | FR-N20.1, FR-N20.2 |
| D-12-04 | 취약점 점검 및 조치 | FR-N20.3 |
| D-12-05 | 보안 시험 | FR-N20.2 |
| D-06-03 | 침해사고 예방 | FR-N20.5 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초안 작성 + 시장조사 반영 | PM Lead Agent (Opus) |
