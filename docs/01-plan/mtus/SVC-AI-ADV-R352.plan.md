# SVC-AI-ADV-R352 Plan: Medical Data Anonymizer v2

## 요구사항 ID: FR-352

## 기능 개요
의료 데이터셋에 k-익명성과 l-다양성을 동시 적용해 준수 여부를 분석한다.

## 성공 기준 (SC)
- SC-R352-1: 동등류 크기 ≥ k 검증
- SC-R352-2: 동등류 내 민감 속성 distinct ≥ l 검증
- SC-R352-3: C/S 원본 데이터 차단
- SC-R352-4: 감사 로그
