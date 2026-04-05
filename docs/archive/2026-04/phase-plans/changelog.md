# Changelog — 공공기관 SaaS 프레임워크

All notable changes to the Public SaaS Framework project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- (Phase 2 계획 중)

### Changed
- (Phase 2 계획 중)

### Fixed
- (Phase 2 계획 중)

---

## [2026-04-05] — Phase 1 Foundation 완료 + 전수 품질 검증

### Added

- **2026-04 품질 개선 사이클 완료 보고서**: `/docs/04-report/quality-improvement-2026-04.md`
  - 15개 MTU 전수 갭 분석 (매치율 98.9%)
  - 22개 파일 코드 품질 분석 (종합 85/100)
  - CSAP 79항목 + N2SF 6영역 감리 (100% 커버리지)
  - 수정사항 검증 리포트 (97.6% 보정 후)

- **아카이브 정리**: `docs/archive/2026-04/_INDEX.md`
  - 15개 MTU PDCA 완료 문서 이관
  - av-skill 아카이브 통합

- **MTU-C5, MTU-C7 _INDEX 등재**: `docs/archive/2026-04/_INDEX.md`
  - MTU-C5: N2SF 6개 영역 통제 (100%)
  - MTU-C7: Policy as Code (Kyverno/OPA) (100%)

- **CSAP D04 심사 주의사항 섹션**: `docs/framework/02-csap/standard-grade/implementation-guide/D04-asset-mgmt.md`
  - 자산 대장 최신화, 폐기 절차, 책임자 지정, 미디어 관리, 클라우드 가상 자산 관리

- **요구사항 ID 체계 문서**: `docs/framework/01-dev-standards/requirement-id-system.md`
  - FR-{모듈}.{번호}, NFR-{번호}, INFR-{번호}, AI-REQ-{번호}, CC-REQ-{번호} 형식 정의
  - 10개 예시 + BNF 문법 정의 + 사용 가이드

### Changed

- **kubeconfig 권한 보안 강화** (CSAP-D08 위반 수정):
  - `/docs/framework/07-infra/k3s-wsl2/scripts/install-k3s.sh` 라인 119
  - `--write-kubeconfig-mode 644` → `--write-kubeconfig-mode 600` (비인가 사용자 접근 차단)
  - `/docs/framework/07-infra/k3s-wsl2/cluster-setup-recipe.md` 라인 114 동기화

- **PII 마스킹 regex 버그 수정** (N2SF N-05 위반 수정):
  - `/docs/framework/03-n2sf/domains/N05-data.md` 라인 201-205
  - regex `test()` + `g` 플래그 혼용 → `new RegExp(pattern.source, 'g')` 패턴으로 변경
  - lastIndex 버그로 인한 PII 마스킹 누락 방지

- **D04 D01~D03 구조 조정** (문서 일관성):
  - 심사 주의사항 헤딩 레벨 통합 배치 (향후 세부 항목별 분산 권고)

### Fixed

- **Critical Issues**: 2건 완료
  - H-01: kubeconfig 권한 (CSAP-D08)
  - H-02: PII 마스킹 regex (N2SF N-05)

- **Important Issues**: 3건 (2건 완료, 1건 설계 의도)
  - IDX-GAP-1: MTU-C5 _INDEX 미등재 ✅ 추가됨
  - IDX-GAP-2: MTU-C7 _INDEX 미등재 ✅ 추가됨
  - F4-GAP-1: MTU-F4 경로 명기 오류 (설계 문서 업데이트 예정)

### Removed

- (생략 — Phase 1은 제거 항목 없음)

---

## [2026-04-01] — Phase 1 Foundation 아카이브 시작

### Added

- **PDCA 아카이브 구조 정리**: `docs/archive/2026-04/`
  - Foundation (MTU-F1~F6): Getting Started, References, Dev Standards, CSAP Simple, Audit T01/T02, CC Harness
  - Core Security (MTU-C1~C5, C7): CSAP Master, D01~D13, N2SF Mapping, Policy as Code
  - Infrastructure (MTU-I1~I2): k3s WSL2, Gitea CI/CD
  - Skills (av-skill): Auto-Vibe Advisor Plugin

- **15개 MTU PDCA 완료 상태**: `.bkit-memory.json`
  - 15개 MTU 평균 매치율: 98.9%
  - CSAP 79항목 커버리지: 100%
  - N2SF 6영역 커버리지: 100%

---

## [2026-03-XX] — Phase 1 상세 설계 및 구현

### Added

- CSAP 표준등급 79항목 마스터 체크리스트
- N2SF 6개 영역 데이터 등급 분류 + 매핑
- k3s WSL2 클러스터 설치 레시피 + 보안 기준
- Policy as Code (Kyverno/OPA) 구현 가이드
- CC 하네스 5개 에이전트 검증 절차
- 행안부 감리기준 T01~T02 템플릿

### Changed

- (초기 phase — 변경 사항 최소)

### Fixed

- (초기 phase — 버그 최소)

---

## [2026-02-XX] — Phase 1 Foundation 착수

### Added

- 프레임워크 초기 구조 설계
- 공공기관 SaaS 요구사항 정의 (CSAP, N2SF, 감리기준)
- PDCA 문서화 기준 수립
- ECC 하네스 통합

---

## Version History Summary

| Version | Release Date | Features | Status |
|---------|---|---|---|
| 1.0.0 (Phase 1 Foundation) | 2026-04-05 | 15개 MTU PDCA 완료, CSAP 79 + N2SF 6 100% 커버리지, 전수 감리 | Complete |
| 2.0.0 (Phase 2 Core Security Impl) | TBD 2026-05 | CSAP D01~D13 + N2SF 구현 코드, 테스트 스위트, CI/CD 통합 | Planned |
| 3.0.0 (Phase 3 AI Gateway) | TBD 2026-06 | Claude API 게이트웨이, 감사 로그, Prompt Injection 방어 | Planned |
| 4.0.0 (Phase 4 Advanced Hardening) | TBD 2026-07 | ISMS-P 연동, 고급 정책, 멀티테넌트 지원 | Planned |

---

**최종 업데이트**: 2026-04-05  
**관리자**: BKIT Quality Team  
**라이선스**: (프로젝트 정책에 따름)
