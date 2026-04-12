# PRD: SVC-CAT-R1 -- 서비스 카탈로그 고도화

> 작성일: 2026-04-10 | 버전: 1.0

## WHY
카탈로그 서비스에 Rate Limiting 미적용(CSAP D-10), Feature Flag 토글 감사 누락(CSAP D-06),
검색 기능 부재 등 운영 고도화가 필요합니다.

## SUCCESS
- FR-CAT.1: Rate Limiting
- FR-CAT.2: 서비스 검색 (이름/slug/설명 부분 일치)
- FR-CAT.3: 카테고리 목록 API
- FR-CAT.4: Feature Flag 토글 감사 로그
- FR-CAT.5: 서비스 통계 (카테고리별 수, 활성/비활성 비율)
