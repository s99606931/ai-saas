# MTU-P12: 파일 관리 서비스 -- Design 문서

> **문서 ID**: DESIGN-MTU-P12 | **버전**: 1.0.0 | **작성일**: 2026-04-05

## 아키텍처

```
API Gateway (/api/v1/file) → file-service (port 3011)
                                  ↓
                              ┌────────────────────┐
                              │ AES-256 암호화     │ (CSAP D-09)
                              │ MIME 검증          │ (CSAP D-12)
                              └────────────────────┘
                                  ↓
                              MinIO (S3 호환, 폐쇄망)
                              PostgreSQL (File 모델)
```

## API 설계

| Method | Path | FR | 설명 |
|--------|------|-----|------|
| POST | /file/upload | FR-P12.1 | 파일 업로드 |
| GET | /file/:id | FR-P12.2 | 파일 다운로드 |
| GET | /file/list | FR-P12.1 | 파일 목록 조회 |
| DELETE | /file/:id | FR-P12.1 | 파일 삭제 |
| GET | /file/:id/meta | FR-P12.1 | 파일 메타데이터 |

## 데이터 모델

- `File`: id, tenantId, name, mimeType, size, storagePath, encrypted, uploadedBy

## 보안 매핑

| CSAP | 구현 |
|------|------|
| D-09 | AES-256 암호화 저장 |
| D-08 | 테넌트별 접근 제어 |
| D-12 | MIME 타입 + 크기 검증 |
| D-06 | 파일 변경 감사 로그 |
