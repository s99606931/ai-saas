# SVC-AI-ADV-R26: Fine-Tuning Data Pipeline DESIGN

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead (Opus)

## 아키텍처 선택: Option B — Pragmatic Balance

데이터 수집 → PII 제거 → 정제 → 포맷 변환 → 검증 → 내보내기

---

## §1 데이터 수집 (FR-ADV26.1)

소스: 대화 로그, 사용자 피드백, 공문서
수집기: 소스별 어댑터 패턴, 배치/실시간 지원

## §2 정제 파이프라인 (FR-ADV26.2)

단계: PII 마스킹 → 중복 제거 (MinHash) → 품질 필터 → 독성 필터
품질 필터: 응답 길이 > 50자, 언어 감지 = ko, 문법 점수 > 0.7

## §3 데이터 포맷 (FR-ADV26.3)

SFT: {"messages": [{"role":"system","content":"..."}, ...]}
DPO: {"prompt":"...", "chosen":"...", "rejected":"..."}
PPO: {"query":"...", "response":"...", "reward": 0.85}

## §4 품질 검증 (FR-ADV26.4)

분포 분석: 카테고리, 토큰 길이, 난이도 분포
편향 검사: 인구통계 편향, 주제 편향

## §5 버전 관리 (FR-ADV26.5)

스냅샷: 데이터셋 버전 + 메타데이터 + 통계 요약
재현: 동일 시드로 동일 분할 보장
