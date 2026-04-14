# SVC-AI-ADV-R657 Design — AI기반 컨테이너 보안 분석 v3

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R657.1~6 구현 |
| 보안 | N2SF N-05 C/S 차단, CSAP D-06 |
| 품질 | TypeScript strict, Vitest 6+ |
| 범위 | platform/services/ai-service/src/lib/container-security-ai-v3.ts |

## 설계 결정
- `ContainerSecurityAIV3` 클래스
- CVE CVSS 최댓값 + 이상행위 가중치 합산
- 위험도: ≥9 CRITICAL, ≥7 HIGH, ≥4 MEDIUM, else LOW
- 권고: CRITICAL→BLOCK / HIGH→QUARANTINE / MEDIUM→MONITOR / LOW→ALLOW
- 위험 syscall 목록: ptrace, kexec_load, mount, init_module

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
