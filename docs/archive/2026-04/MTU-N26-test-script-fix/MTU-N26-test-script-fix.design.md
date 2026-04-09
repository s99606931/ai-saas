# Design: MTU-N26 테스트 스크립트 개선

> **버전**: 1.0.0 | **작성일**: 2026-04-08 | **작성자**: PM Lead

---

## 수정 사항

### TC-2.3: Act Runner API 경로
- **현재**: `/api/v1/admin/runners` (빈 응답)
- **수정**: `docker logs gitea-runner` 명령으로 Runner 상태 확인
- **근거**: Gitea 1.22의 Actions Runner 상태는 Admin API가 아닌 Runner 컨테이너 로그로 확인

### TC-5.3: Grafana Login Ping
- **현재**: `/api/login/ping` (404)
- **수정**: `/api/health` 엔드포인트 사용
- **근거**: Grafana 12.x에서 `/api/health`가 표준 health check 엔드포인트

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 최초 작성 | PM Lead |
