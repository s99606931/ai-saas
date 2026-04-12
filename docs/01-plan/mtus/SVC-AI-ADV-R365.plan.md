# SVC-AI-ADV-R365 Plan: Regulatory Text Differ

## 요구사항 ID: FR-365

## 기능 개요
규정/지침 텍스트의 이전/이후 버전을 비교해 추가/삭제/수정을 diff로 산출하고, 변경 영향도 점수 계산.

## 성공 기준 (SC)
- SC-R365-1: 줄 단위 diff (added/removed/unchanged)
- SC-R365-2: 변경 영향도 점수(0~1)
- SC-R365-3: C/S 등급 차단
- SC-R365-4: 감사 로그

## CSAP/N2SF
- D-12 / N-05
