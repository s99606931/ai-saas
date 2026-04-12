# SVC-AI-ADV-R361 Plan: AI Code Quality Gate

## 요구사항 ID: FR-361

## 기능 개요
AI 기반 코드 품질 게이트. 복잡도/테스트커버리지/중복률/보안이슈를 종합 점수화하고 임계치 미달 시 병합 차단.

## 성공 기준 (SC)
- SC-R361-1: 종합 점수 계산 (가중 평균)
- SC-R361-2: 임계치 미달 시 block=true
- SC-R361-3: C/S 등급 차단
- SC-R361-4: 감사 로그

## CSAP/N2SF
- D-12 개발 보안 / N-05 등급 차단
