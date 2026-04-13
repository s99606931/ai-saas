# SVC-AI-ADV R286~R294 아카이브 인덱스

**배치**: 트랙 C 8차
**완료일**: 2026-04-12
**테스트**: 62/62 통과

| MTU | 기능명 | Plan | Design | 구현 파일 | 테스트 수 |
|-----|--------|------|--------|-----------|-----------|
| R286 | AI기반 SLA 위반 예방 | SVC-AI-ADV-R286.plan.md | SVC-AI-ADV-R286.design.md | sla-violation-preventer-ai.ts | 7 |
| R287 | AI기반 공공 행정 언어 교정 | SVC-AI-ADV-R287.plan.md | SVC-AI-ADV-R287.design.md | public-admin-language-corrector.ts | 7 |
| R288 | AI기반 멀티테넌트 보안 감사 | SVC-AI-ADV-R288.plan.md | SVC-AI-ADV-R288.design.md | multitenant-security-auditor-ai.ts | 7 |
| R289 | AI기반 서비스 에코시스템 매핑 | SVC-AI-ADV-R289.plan.md | SVC-AI-ADV-R289.design.md | service-ecosystem-mapper-ai.ts | 6 |
| R290 | AI기반 자동 운영 매뉴얼 생성 | SVC-AI-ADV-R290.plan.md | SVC-AI-ADV-R290.design.md | operations-manual-generator-ai.ts | 7 |
| R291 | AI기반 공공기관 리스크 스코어링 | SVC-AI-ADV-R291.plan.md | SVC-AI-ADV-R291.design.md | public-institution-risk-scorer.ts | 7 |
| R292 | AI기반 API 응답 품질 자동 평가 | SVC-AI-ADV-R292.plan.md | SVC-AI-ADV-R292.design.md | api-response-quality-evaluator.ts | 7 |
| R293 | AI기반 데이터 거버넌스 대시보드 백엔드 | SVC-AI-ADV-R293.plan.md | SVC-AI-ADV-R293.design.md | data-governance-dashboard-ai.ts | 7 |
| R294 | AI기반 보안 패치 우선순위화 | SVC-AI-ADV-R294.plan.md | SVC-AI-ADV-R294.design.md | security-patch-prioritizer-ai.ts | 7 |

## CSAP/N2SF 준수 요약

- 전 MTU: N2SF N-05 C/S 등급 데이터 전송 차단 (guardDataGrade)
- 전 MTU: getAuditLog() append-only 감사 로그
- R288: 멀티테넌트 격리 위반 탐지 (cross-tenant 접근 이벤트)
- R294: CVSS 기반 패치 우선순위 점수 계산
