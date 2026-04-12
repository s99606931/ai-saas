# SVC-AI-ADV-R18: Prompt A/B Testing DESIGN

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead (Opus)

## 아키텍처 선택: Option B — Pragmatic Balance

해시 기반 트래픽 분배 + 실시간 메트릭 + 통계 유의성 자동 판정

---

## Design Anchor

- **WHY**: 프롬프트 변경이 실제 품질에 미치는 영향을 과학적으로 검증
- **HOW**: 사용자 해시 기반 일관된 분배 + 다차원 메트릭 수집 + Z-test 판정
- **CONSTRAINT**: 최소 표본 크기 달성 전 판정 금지, 감사 로그 필수

---

## §1 실험 정의 (FR-ADV18.1)

Experiment 구조: id, name, control (프롬프트), variants (프롬프트[]), trafficSplit (%), status, startDate, endDate
상태: draft -> running -> concluded -> archived

## §2 트래픽 라우터 (FR-ADV18.2)

MurmurHash3(userId + experimentId) % 100 → 버킷 할당
동일 사용자 = 항상 동일 variant 노출 (세션 일관성)

## §3 메트릭 수집 (FR-ADV18.3)

수집 메트릭:
- 응답 품질 점수 (LLM-as-a-Judge, R16 연동)
- 응답 지연시간 (ms)
- 토큰 사용량 (입력 + 출력)
- 사용자 피드백 (thumbs up/down, R19 연동)

## §4 통계 분석 (FR-ADV18.4)

Two-proportion Z-test: 성공률 비교
최소 표본: 각 variant 100건 이상
유의수준: alpha = 0.05 (95% 신뢰도)

## §5 자동 판정 (FR-ADV18.5)

- p < 0.05 + variant 우수: 자동 승격 (variant를 새 control로)
- p < 0.05 + control 우수: 자동 롤백
- p >= 0.05: 무승부 → 실험 연장 또는 종료

## §6 실험 이력 (FR-ADV18.6)

완료된 실험 결과 아카이브 + 교훈 메타데이터 저장
