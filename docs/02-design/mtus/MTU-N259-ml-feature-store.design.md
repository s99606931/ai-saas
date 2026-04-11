# MTU-N259: ML 피처 스토어 — 설계 문서

> **버전**: 1.0 | **작성일**: 2026-04-12 | **작성자**: PM Lead
> **Plan 참조**: MTU-N259-ml-feature-store.plan.md

---

## Design Anchor

| 항목 | 결정 |
|------|------|
| 아키텍처 | 이중 저장소 (오프라인: append-only 로그, 온라인: 인메모리 캐시) |
| 패턴 | Repository, Registry, Observer (피처 갱신 알림) |
| 의존성 | 독립 모듈 (AI 서비스 lib 내) |

---

## §1 피처 스키마 (FR-N259.1)
- 이름, 타입(number/string/boolean/array/embedding), 설명, 태그
- 스키마 진화: backward compatible (신규 컬럼 추가만, 삭제 불가)

## §2 피처 그룹 (FR-N259.2)
- 엔티티 기반 그룹 (user, tenant, document, request)
- 조인 키로 피처 조합

## §3 오프라인 저장소 (FR-N259.3)
- append-only 로그 구조, 시점(timestamp) 기반 조회 (point-in-time)
- 배치 계산 결과 적재

## §4 온라인 저장소 (FR-N259.4)
- 인메모리 Map (TTL 기반 캐시)
- 조회 지연 <10ms

## §5 버저닝 및 계보 (FR-N259.5)
- 시맨틱 버전 (major.minor)
- 소스→변환→피처 계보 그래프

## §6 모니터링 (FR-N259.6)
- 신선도 (마지막 갱신 시간), 분포 이동 감지, 누락률

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-12 | 초기 Design 작성 | PM Lead |
