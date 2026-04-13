# SVC-AI-ADV-R399 Plan: Smart Document Router

## Context Anchor
- **WHY**: 수신 문서 자동 분류 및 담당자 배정으로 처리 지연 단축
- **WHO**: 문서 접수 담당, 부서 운영
- **RISK**: 오배정 시 처리 누락
- **SUCCESS**: SC-R399-1 부서 매칭, SC-R399-2 담당자 로드 밸런싱
- **SCOPE**: 키워드 기반 부서 분류, 부서 내 최저 로드 담당자 선택

## 요구사항
- FR-R399.1: 부서별 키워드 등록
- FR-R399.2: 문서에 대한 부서 매칭 + confidence
- FR-R399.3: 부서 내 currentLoad 최소 담당자 선택
- FR-R399.4: N2SF C/S 등급 차단
- FR-R399.5: CSAP D-06 감사 로그

## 성공 기준 (SC)
- SVC-AI-ADV-R399-SC01: 테스트 5개+ 통과
- SVC-AI-ADV-R399-SC02: TypeScript strict 0 오류

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-13 | 최초 작성 | ai-impl-b |
