# MTU-N240: 공공 API 표준 자동 검증 -- Design

> **버전**: 1.0 | **작성일**: 2026-04-10

## 검증 규칙 체계

### 공공 API 표준 응답 형식
```json
{
  "resultCode": "200",
  "resultMsg": "OK",
  "currentPage": 1,
  "totalCount": 100,
  "data": []
}
```

### 표준 에러 코드
- 200: 정상
- 400: 잘못된 요청
- 401: 인증 실패
- 403: 권한 없음
- 404: 리소스 없음
- 500: 서버 오류

### API 보안 표준
- Bearer Token 또는 API Key 인증 필수
- TLS 1.2+ 필수
- CORS 허용 도메인 명시적 설정
- Rate Limiting 설정 필수
