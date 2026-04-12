# SVC-AI-ADV-R125 — RAG Source Attribution

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: PM Lead
> 원 요청 번호: R125

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | RAG 응답에 출처(인용) 자동 부착 + 신뢰도 채점 + 하이라이트 마크 |
| 품질 | 청크-응답 매칭(token overlap), 인용 ID 부여, citation map JSON |
| 보안 | C/S 등급 청크 차단, 출처 메타데이터만 사용(원문 PII 마스킹) |
| 비용 | 외부 모델 비의존, O(n*m) 토큰 매칭 |

## Context Anchor

- **WHY**: 공공기관 AI 답변 신뢰성 확보 위해 출처 인용 필수(감리 항목). 어떤 청크가 어느 문장에 기여했는지 명시.
- **WHO**: RAG 응답 후처리, 사용자 UI(인용 표시), 감리관
- **RISK**: 잘못된 출처 매칭 → 토큰 overlap 임계값 + 신뢰도 채점
- **SUCCESS**: attribute(answer, chunks) → AttributedAnswer { sentences[], citations[], avgConfidence }
- **SCOPE**: In — 출처 매칭/하이라이트. Out — 임베딩 검색(외부 모듈)

## 요구사항

- **FR-R125.1**: 청크 등록 (id, source, content, grade)
- **FR-R125.2**: 응답 문장 분할 (한·영 마침표, 줄바꿈)
- **FR-R125.3**: 문장-청크 토큰 overlap 점수 (Jaccard) 계산
- **FR-R125.4**: 임계값 이상 매칭 시 인용 부여 (citation id [1], [2]...)
- **FR-R125.5**: 하이라이트 마크업 — `[doc-id:span]` 형식 부착
- **FR-R125.6**: 인용 신뢰도 채점 (0~1) — overlap 비율
- **FR-R125.7**: avgConfidence 0.3 미만 시 `low-confidence` 플래그
- **FR-R125.8**: N2SF C/S 등급 청크 차단 + 출처 메타데이터 PII 마스킹
- **FR-R125.9**: `getAuditLog()`
- **NFR-R125.1**: TypeScript strict 0, 테스트 80%+

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R125.1~7 | rag-source-attribution.ts | .test.ts | D-12 |
| FR-R125.8 | grade guard | test | N2SF N-05 |
| FR-R125.9 | auditLog | test | D-06 |
