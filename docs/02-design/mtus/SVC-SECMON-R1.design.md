# Design: SVC-SECMON-R1 -- 보안 모니터링 서비스 고도화

> 작성일: 2026-04-10 | 버전: 1.0

---

## 변경 파일
- `src/handlers/security.handler.ts` -- 알림 확인, 대시보드, IP 검증 강화, 만료 정리
- `src/middleware/rate-limit.middleware.ts` (NEW)
- `src/routes.ts` -- 신규 라우트 등록 + Rate Limiting
- `tests/integration/security-enhancements.test.ts` (NEW)

## 구현 상세
- acknowledgeAlertHandler: alerts 배열에서 id로 찾아 acknowledged=true 설정
- alertsSummaryHandler: 심각도별 groupBy 집계 (인메모리이므로 reduce 사용)
- getBlocklistHandler: 조회 시 만료 엔트리 자동 정리
- ipBlockSchema: z.string().ip() 또는 정규식 검증 추가
