# SVC-AI-ADV-R477 Plan — AI기반 공공기관 문서 자동 요약 v2

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 장문의 공공기관 문서를 자동 요약하여 행정 처리 효율화 |
| WHO | 공무원, 민원 담당자 |
| RISK | C/S 등급 문서의 외부 AI 전송 금지 필요 |
| SUCCESS | SC-R477-1: 문서 등록 / SC-R477-2: 요약 생성 / SC-R477-3: C/S 차단 |
| SCOPE | public-document-summarizer-v2.ts 구현 |

## 요구사항
- FR-R477.1: 문서 입력 (docId, content, grade: 'O'|'C'|'S', category)
- FR-R477.2: C/S 등급 문서 처리 차단 (throw BLOCKED)
- FR-R477.3: O 등급 문서 요약 (첫 문장 + 핵심어 추출 기반 요약)
- FR-R477.4: 핵심어 추출 (빈도 기반 상위 5개 명사)
- FR-R477.5: 감사 로그 전수 기록 (getAuditLog)

## 추적성
FR-R477.* ↔ `public-document-summarizer-v2.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
