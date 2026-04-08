# MTU-N20: 보안 최종 점검 Plan

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N20 |
| Phase | Phase 7 New (보안) |
| 버전 | 1.0.0 |
| 상태 | Approved |
| 작성일 | 2026-04-08 |
| 작성자 | PM Lead Agent (Claude Opus) |
| 복잡도 | MED |
| 의존 MTU | MTU-N08 (보안 강화), MTU-C8 (SBOM+Sigstore) |
| PRD | docs/00-pm/MTU-N20-security-final-audit.prd.md |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | v1.0.0 릴리스 전 보안 취약점 전수 점검 -- CSAP 인증 사전 요건 |
| 기술 | Trivy 이미지 스캔, OWASP ZAP DAST, pnpm audit 3단계 점검 |
| 보안 | CSAP D-12 시스템 개발 보안 10개 항목 충족 증빙 |
| 감리 | 취약점 점검 결과 보고서 -- 감리 제출용 증적 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| **WHY** | CSAP D-12 요건상 릴리스 전 취약점 점검 필수. 기존 security-audit.sh가 있으나 실행 결과 해석 가이드, 이미지 스캔, CI/CD 통합이 미비 |
| **WHO** | 보안 담당자, 감리 위원, DevOps 엔지니어 |
| **RISK** | HIGH/CRITICAL 취약점 발견 시 릴리스 차단, ZAP Full Scan 시 서비스 가용성 영향 |
| **SUCCESS** | 5개 보안 가이드 문서 완성, 각 가이드에 실행 예시 + 결과 해석 포함 |
| **SCOPE** | 보안 점검 가이드 문서 5종 (docs/security/) |

---

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 산출물 |
|-------|---------|---------|--------|
| FR-N20.1 | Trivy 컨테이너 이미지 스캔: 18개 Dockerfile 대상, HIGH/CRITICAL 0건 기준, JSON/Table 리포트 | P0 | docs/security/trivy-image-scan-guide.md |
| FR-N20.2 | OWASP ZAP 동적 분석: Baseline + Full Scan 절차, OpenAPI 3.0 연동, 결과 해석 | P0 | docs/security/owasp-zap-dast-guide.md |
| FR-N20.3 | 의존성 보안 감사: pnpm audit 실행 + 결과 분석 + 조치 절차 (HIGH 0건 유지) | P0 | docs/security/dependency-audit-guide.md |
| FR-N20.4 | 보안 점검 결과 보고서 템플릿: CSAP D-12 감리 증적용 표준 양식 | P1 | docs/security/audit-report-template.md |
| FR-N20.5 | CI/CD 보안 파이프라인: Gitea Actions에 Trivy/audit 스테이지 통합 | P1 | docs/security/cicd-security-pipeline.md |

---

## 추적성 매트릭스

| FR ID | PRD 항목 | Design 섹션 | 산출물 | 테스트 | CSAP |
|-------|---------|------------|--------|--------|------|
| FR-N20.1 | FR-N20.1 | D-N20.1 | trivy-image-scan-guide.md | Trivy 스캔 실행 확인 | D-12-01 |
| FR-N20.2 | FR-N20.2 | D-N20.2 | owasp-zap-dast-guide.md | ZAP 스캔 실행 확인 | D-12-05 |
| FR-N20.3 | FR-N20.3 | D-N20.3 | dependency-audit-guide.md | pnpm audit 실행 확인 | D-12-04 |
| FR-N20.4 | FR-N20.4 | D-N20.4 | audit-report-template.md | 템플릿 완전성 검증 | D-12-01 |
| FR-N20.5 | FR-N20.5 | D-N20.5 | cicd-security-pipeline.md | 파이프라인 실행 확인 | D-06-03 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초안 작성 | PM Lead Agent (Opus) |
