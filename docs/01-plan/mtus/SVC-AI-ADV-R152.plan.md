# MTU Plan — SVC-AI-ADV-R152 Output Regression Detector

> **원 요청 번호**: R152
> **모듈**: `platform/services/ai-service/src/lib/output-regression-detector.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 모델 배포 전 golden-set 대비 회귀 자동 감지 → 품질 저하 방지 |
| 기술 | 골든셋 비교 + 유사도 스코어 + 회귀 임계값 판정 |
| 보안 | 테스트 입력 보관, 감사 로그 |
| 규제 | CSAP D-12 소프트웨어 변경관리, 품질관리 |

## Context Anchor

- WHY: 모델 업데이트 시 일부 답변 품질이 저하 → 수동 검증 불가, 자동화 필요
- WHO: AI 모델 배포 담당자, QA팀
- RISK: 배포 후 품질 저하로 민원 증가
- SUCCESS: 회귀 발생 케이스 전수 식별, 배포 게이트 제공
- SCOPE: addGolden → runCandidate → evaluate(similarity) → regression verdict

## FR

| ID | 설명 |
|----|------|
| FR-R152.1 | GoldenCase(id, input, expectedOutput) 등록 |
| FR-R152.2 | candidate(id, output) 제출 |
| FR-R152.3 | 유사도: Jaccard 토큰 오버랩 (tokenize = lowercase 분할) |
| FR-R152.4 | per-case 판정: similarity < threshold → regressed |
| FR-R152.5 | 전체 보고서: passCount/regressionCount/regressionRate |
| FR-R152.6 | shouldBlock: regressionRate > blockThreshold → true (배포 차단) |
| FR-R152.7 | reset() 재사용 가능 |
| FR-R152.8 | 감사 로그 + C/S 차단 + 중복 id 거부 |

## 테스트 케이스

- 완벽 일치 → regression 0
- 완전 불일치 → 모두 regression
- 부분 일치 (일부만 회귀)
- regressionRate 계산
- shouldBlock 판정
- 미제출 케이스는 regressed로 집계
- reset 후 재사용
- 중복 golden id 거부
- 빈 입력 거부
- C/S 차단
