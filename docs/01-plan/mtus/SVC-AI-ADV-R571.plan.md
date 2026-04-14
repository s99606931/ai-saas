# SVC-AI-ADV-R571 Plan — AI기반 공공 서비스 추천 엔진 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 시민에게 맞춤형 공공 서비스를 추천하여 접근성 향상 |
| WHO | 민원 담당자, 디지털 서비스 팀 |
| RISK | N2SF C/S 데이터 AI 전송 금지 — 등급 확인 필수 |
| SUCCESS | SC-R571-1: 사용자 프로파일 분석 / SC-R571-2: 서비스 매칭 / SC-R571-3: 추천 목록 생성 |
| SCOPE | public-service-recommender-v3.ts 구현 |

## 요구사항
- FR-R571.1: 입력 (userId, dataGrade: 'C'|'S'|'O', ageGroup: string, region: string, requestedCategories: string[], availableServices: {serviceId, category, region, ageGroups: string[]}[])
- FR-R571.2: N2SF C/S 등급 → BLOCKED 에러 (AI API 전송 금지)
- FR-R571.3: 매칭 기준 = category가 requestedCategories에 포함 && (region==='ALL'||region===입력region) && ageGroups에 입력ageGroup 포함
- FR-R571.4: userId 마스킹 (앞2자+***+뒤2자, 4자 미만이면 ***)
- FR-R571.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R571.* ↔ `public-service-recommender-v3.ts` ↔ 테스트 ↔ CSAP D-06, N-05
