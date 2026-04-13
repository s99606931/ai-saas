# SVC-AI-ADV R277~R285 아카이브 인덱스

**배치**: 트랙 C 7차
**완료일**: 2026-04-12
**테스트**: 63/63 통과

| MTU | 기능명 | Plan | Design | 구현 파일 | 테스트 수 |
|-----|--------|------|--------|-----------|-----------|
| R277 | AI기반 장애 복구 시뮬레이션 | SVC-AI-ADV-R277.plan.md | SVC-AI-ADV-R277.design.md | disaster-recovery-simulator-ai.ts | 7 |
| R278 | AI기반 공공 서비스 이용 패턴 분석 | SVC-AI-ADV-R278.plan.md | SVC-AI-ADV-R278.design.md | public-service-usage-analyzer.ts | 6 |
| R279 | AI기반 실시간 보안 정책 시행 | SVC-AI-ADV-R279.plan.md | SVC-AI-ADV-R279.design.md | realtime-security-policy-enforcer.ts | 7 |
| R280 | AI기반 멀티모달 문서 이해 v2 | SVC-AI-ADV-R280.plan.md | SVC-AI-ADV-R280.design.md | multimodal-document-understanding-v2.ts | 7 |
| R281 | AI기반 자동 서비스 레지스트리 | SVC-AI-ADV-R281.plan.md | SVC-AI-ADV-R281.design.md | service-registry-ai.ts | 7 |
| R282 | AI기반 공공기관 예산 계획 지원 | SVC-AI-ADV-R282.plan.md | SVC-AI-ADV-R282.design.md | budget-planning-assistant-ai.ts | 7 |
| R283 | AI기반 API 라이프사이클 관리 | SVC-AI-ADV-R283.plan.md | SVC-AI-ADV-R283.design.md | api-lifecycle-manager-ai.ts | 7 |
| R284 | AI기반 스트리밍 데이터 처리 최적화 | SVC-AI-ADV-R284.plan.md | SVC-AI-ADV-R284.design.md | streaming-data-processor-optimizer.ts | 7 |
| R285 | AI기반 제로트러스트 보안 검증 | SVC-AI-ADV-R285.plan.md | SVC-AI-ADV-R285.design.md | zero-trust-security-verifier-ai.ts | 8 |

## CSAP/N2SF 준수 요약

- 전 MTU: N2SF N-05 C/S 등급 데이터 전송 차단 (guardDataGrade)
- 전 MTU: getAuditLog() append-only 감사 로그
- R278: SHA-256 userId PII 마스킹 (maskUserId)
- R285: 제로트러스트 신뢰 점수 모델 + 이상 이벤트 기록
