# SVC-AI-ADV-R174 Design — AI기반 취약점 패치 제안

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | CVE 기반 취약점 신속 대응 체계 구축 |
| WHO | 보안팀, 운영팀 |
| RISK | CRITICAL 취약점 방치 시 보안 사고 |
| SUCCESS | 심각도별 패치 권고 자동 생성 |
| SCOPE | 구현 파일: `vulnerability-patch-advisor.ts` |

## 클래스 설계

### `VulnerabilityPatchAdvisor`

| 메서드 | 설명 |
|--------|------|
| `registerVulnerability(vuln)` | CVE 취약점 등록 |
| `registerPatch(patch)` | 패치 정보 등록 |
| `generateAdvice(vulnId)` | 패치 권고 생성 |
| `generateReport()` | 심각도별 정렬 보고서 |
| `getAuditLog()` | CSAP D-06 감사 로그 반환 |

## 보안 설계

- CRITICAL: 즉시 패치 권고 (immediate)
- MEDIUM 이하: 다음 유지보수 주기 권고

## 추적성 매트릭스

| FR ID | 구현 메서드 | 테스트 케이스 | CSAP |
|-------|-----------|--------------|------|
| FR-R174.1 | registerVulnerability | 취약점 등록 | D-12 |
| FR-R174.2 | generateAdvice | CRITICAL 즉시 권고 | D-06 |
| FR-R174.3 | generateReport | 심각도 정렬 | D-06 |
| FR-R174.4 | generateReport | 미패치 목록 | D-06 |
| FR-R174.5 | getAuditLog | 감사 로그 | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 최초 작성 | ai-impl-a |
