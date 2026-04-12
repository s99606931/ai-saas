# SVC-AI-ADV-R245 — AI 기반 서비스 의존성 취약점 스캔

> 작성일: 2026-04-13 | 버전: 1.0.0 | 작성자: Implementer (자율 생성)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 의존성 패키지 취약점 등록 + 심각도 분류 + 패치 권고 |
| 품질 | CVE 기반 심각도 (critical/high/medium/low), 패치 버전 추천 |
| 보안 | C/S 등급 차단, CSAP D-12, 감사 로그 |
| 비용 | 로컬 취약점 DB, 외부 의존 없음 |

## Context Anchor

- **WHY**: 오픈소스 의존성 취약점 방치로 보안 사고 위험
- **WHO**: 보안 엔지니어, DevSecOps 담당자
- **RISK**: 취약점 DB 갱신 지연 → 수동 CVE 등록 API 제공
- **SUCCESS**: 패키지 등록 → CVE 매핑 → 스캔 → 패치 권고 반환
- **SCOPE**: In — 취약점 탐지, 권고. Out — 자동 패치

## 요구사항

- **FR-R245.1**: 패키지 의존성 등록
- **FR-R245.2**: CVE 취약점 등록 및 패키지 매핑
- **FR-R245.3**: 취약점 스캔 실행
- **FR-R245.4**: 심각도별 패치 권고 생성
- **FR-R245.5**: N2SF guard, CSAP D-12, 감사 로그
- **NFR-R245.1**: TypeScript strict, 테스트 5개+

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R245.1~5 | dependency-vulnerability-scanner-ai.ts | .test.ts | D-12 |
