# MTU-A5: Docusaurus 문서 포털 — 설계 문서

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-A5 |
| Phase | Phase 4 Advanced |
| 문서 유형 | Design |
| 버전 | 1.0.0 |
| 작성일 | 2026-04-05 |
| Plan 참조 | `docs/01-plan/mtus/MTU-A5-docusaurus-portal.plan.md` |
| FR 매핑 | FR-7.2 |

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| WHY | 68개+ 산출물 파일을 역할별로 탐색 가능한 통합 포털 부재 시 감리 효율 저하 |
| WHO | CTO/PM/Dev/Auditor/Security 5개 역할 |
| RISK | MkDocs Material 유지보수 모드 진입 → 장기 운영 보안 위험 |
| SUCCESS | k3s 배포 + 역할별 사이드바 5개 + CSAP MDX 인터랙티브 뷰어 |

---

## 1. 아키텍처 옵션 평가

### Option A: MkDocs Material 유지
- 장점: 기존 생태계 활용
- 단점: 2025-11 유지보수 모드, MDX 미지원

### Option B: Docusaurus 3.x (선택)
- 장점: MDX 네이티브, React 컴포넌트, 활성 개발, Meta OSS
- 단점: JavaScript 기반 빌드 필요
- **선택 근거**: CSAP 체크리스트 인터랙티브 뷰어 구현 필수

### Option C: GitBook
- 장점: SaaS 호스팅
- 단점: 폐쇄망 배포 불가 (CLAUDE.md 절대 제약 4번)

**최종 선택: Option B (Docusaurus 3.x)**

---

## 2. 산출물 구조

| 파일 | 문서 유형 | 핵심 내용 |
|------|---------|---------|
| `08-documentation-portal/docusaurus-setup-guide.md` | 구현 가이드 | 설치, 설정, k3s 배포, 플러그인 |
| `08-documentation-portal/content-organization.md` | 아키텍처 레퍼런스 | 역할별 사이드바, 콘텐츠 분류, MDX 예시 |

---

## 3. 역할별 사이드바 설계

| 역할 | 사이드바 ID | 주요 콘텐츠 |
|------|-----------|-----------|
| CTO/PM | ctoSidebar | 경영진 대시보드, 로드맵, 감리 현황 |
| 개발자 | devSidebar | CSAP 구현, AI 연동, 인프라 |
| 감리관 | auditorSidebar | T01~T07 산출물, 완료 체크리스트 |
| 보안 담당 | securitySidebar | CSAP 79항목, N2SF, ISMS-P |
| PM | pmSidebar | MTU 계획, 요구사항, 일정 |

---

## 4. Design Anchor

- Plan SC: FR-7.2 (문서 포털)
- Design Ref: Docusaurus 3.x 공식 문서
- Design Ref: MTU-F1~F6 기반 문서 완비 전제

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 최초 작성 — Option B Docusaurus 3.x 선택 | Claude Code |
