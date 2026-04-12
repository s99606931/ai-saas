# PRD: SVC-MENU-R1 -- 메뉴 관리 서비스 고도화

> 작성일: 2026-04-10 | 버전: 1.0

## WHY
메뉴 서비스에 Rate Limiting 미적용(CSAP D-10 위반), 삭제/순서변경 감사 로그 누락(CSAP D-06),
순서변경 핸들러 테넌트 격리 미적용(CSAP D-08) 등 보안 강화가 필요합니다.

## WHO
- SaaS 테넌트 관리자: 메뉴 구조 관리, 검색
- 감리 담당자: 변경 추적 감사

## RISK
- Rate Limiting 없이 메뉴 API DoS 취약
- 삭제/순서변경 감사 로그 없으면 감리 시 변경 추적 불가
- 순서변경 시 타 테넌트 메뉴 수정 가능

## SUCCESS
- FR-MENU.1: Rate Limiting (읽기 100/60s, 쓰기 30/60s, 삭제 10/300s)
- FR-MENU.2: 메뉴 검색 (label, path 부분 일치)
- FR-MENU.3: 삭제 감사 로그 추가
- FR-MENU.4: 순서변경 테넌트 격리 + 감사 로그
- FR-MENU.5: 메뉴 통계 (테넌트별 총 메뉴 수, 깊이 분포)

## SCOPE
- 기존 6개 라우트 유지 + 2개 신규 (search, stats)
- Rate Limiting 미들웨어 신규 생성
- 기존 핸들러 감사 로그/테넌트 격리 보강
