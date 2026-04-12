# SVC-AI-ADV-R157 — 컨테이너 보안 스캐너 AI

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: Implementer

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 컨테이너 이미지 CVE 분석 + 우선순위 자동 결정 + 패치 권고 |
| 품질 | CVSS 점수 기반 결정적 우선순위화, 심각도별 분류 |
| 보안 | C/S 등급 차단, 감사 로그 |
| 비용 | 로컬 CVE DB 기반, 외부 스캐너 mock 주입 |

## Context Anchor

- **WHY**: 공공기관 컨테이너 환경에서 CVE 미패치는 CSAP 결함 → 자동 우선순위화로 신속 대응
- **WHO**: 보안 담당자, DevSecOps 엔지니어
- **RISK**: false positive → CVSS 점수 + 환경 컨텍스트 이중 확인
- **SUCCESS**: 이미지 등록 → CVE 스캔 → 우선순위 결정 → 패치 권고 반환
- **SCOPE**: In — CVE 등록/스캔/우선순위화/패치권고. Out — 실제 패치 실행

## 요구사항

- **FR-R157.1**: CVE 데이터 등록 (id, cvss, severity, affectedPackages)
- **FR-R157.2**: 이미지 스캔 (패키지 목록 입력 → CVE 매칭)
- **FR-R157.3**: 우선순위 결정 (CVSS 9+: critical, 7~9: high, 4~7: medium, <4: low)
- **FR-R157.4**: 패치 권고 생성 (패키지 업그레이드 경로)
- **FR-R157.5**: N2SF guard, 감사 로그
- **NFR-R157.1**: TypeScript strict, 테스트 5개+

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R157.1~5 | container-security-scanner-ai.ts | .test.ts | D-08 |
