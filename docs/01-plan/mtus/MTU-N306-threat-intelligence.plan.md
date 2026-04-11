# MTU-N306 보안 위협 인텔리전스 통합 Plan

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 최초 작성 | PM-Agent |

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 외부 위협 인텔리전스 통합으로 선제적 보안 대응 |
| 기술 | IOC 수집, STIX/TAXII 호환, 위협 상관 분석, 자동 차단 |
| 보안 | IOC 기반 자동 탐지/차단, CSAP D-06 침해사고 관리 |
| 운영 | 실시간 위협 피드, 자동 방화벽 연동, 위협 대시보드 |

## Context Anchor

- **WHY**: 공공기관 사이버 위협 증가, 선제적 방어 체계 필수
- **WHO**: SOC 운영자, 보안 관리자
- **RISK**: IOC 오탐으로 정상 트래픽 차단, 위협 피드 지연
- **SUCCESS**: 위협 탐지율 90%+, 평균 대응 시간 5분 이내
- **SCOPE**: IOC 수집 -> 상관 분석 -> 위협 평가 -> 자동 대응

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 |
|-------|---------|---------|
| FR-N306.1 | IOC (IP/도메인/해시) 피드 수집 | HIGH |
| FR-N306.2 | STIX/TAXII 포맷 파싱 | HIGH |
| FR-N306.3 | 위협 상관 분석 (로그 매칭) | HIGH |
| FR-N306.4 | 자동 차단 정책 생성 | MED |
| FR-N306.5 | 위협 인텔리전스 대시보드 | MED |
| FR-N306.6 | 감사 로그 전수 기록 | HIGH |

## 성공 기준

- SC-1: IOC 매칭 정확도 90%+
- SC-2: 위협 탐지~대응 평균 5분 이내
- SC-3: 오탐률 10% 이하
- SC-4: 감사 로그 커버리지 100%

## 추적성 매트릭스

| FR ID | 산출물 | 테스트 | CSAP |
|-------|--------|--------|------|
| FR-N306.1 | threat-intelligence.ts | T-N306.1 | D-06 |
| FR-N306.2 | threat-intelligence.ts | T-N306.2 | D-06 |
| FR-N306.3 | threat-intelligence.ts | T-N306.3 | D-06 |
| FR-N306.4 | threat-intelligence.ts | T-N306.4 | D-08 |
| FR-N306.5 | threat-intelligence.ts | T-N306.5 | D-06 |
| FR-N306.6 | threat-intelligence.ts | T-N306.6 | D-06 |
