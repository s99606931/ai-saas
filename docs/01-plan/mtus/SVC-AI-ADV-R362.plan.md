# SVC-AI-ADV-R362 Plan: Semantic Similarity Engine v2

## 요구사항 ID: FR-362

## 기능 개요
코사인 유사도와 BM25 점수를 앙상블한 의미 유사도 엔진. 문서 검색/중복 탐지에 활용.

## 성공 기준 (SC)
- SC-R362-1: 코사인 + BM25 앙상블 (가중치 조정 가능)
- SC-R362-2: topK 결과 정렬 반환
- SC-R362-3: C/S 등급 차단
- SC-R362-4: 감사 로그

## CSAP/N2SF
- D-06 감사 / N-05 등급 차단
