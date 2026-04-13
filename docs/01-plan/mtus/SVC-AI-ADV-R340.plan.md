# SVC-AI-ADV-R340 Plan: AI기반 서비스 카탈로그 자동 갱신

## 요구사항 ID: FR-340

## 기능 개요
서비스 카탈로그 항목의 상태를 자동으로 갱신하고 만료/비활성 항목을 탐지한다.

## 성공 기준 (SC)
- SC-R340-1: 항목 상태 변경 이력 추적
- SC-R340-2: lastUpdated 기준 stale 항목 탐지 (now - lastUpdated > staleTtlMs)
- SC-R340-3: C/S등급 카탈로그 데이터 전송 차단 (N2SF N-05)
- SC-R340-4: 모든 갱신 이벤트 감사 로그 기록
