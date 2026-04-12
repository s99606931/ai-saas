# SVC-FILEUP-R34 DESIGN: File Upload Handler

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead

## 검증 흐름

```
파일 수신
  -> 크기 검증 (FR-FU.1)
  -> MIME 화이트리스트 (FR-FU.2)
  -> 매직 바이트 + 확장자 일치 (FR-FU.3)
  -> 파일명 새니타이제이션 (FR-FU.4)
  -> SHA-256 해시 (FR-FU.5)
  -> 성공: 검증된 파일 메타데이터 반환
  -> 실패: 상세 에러 반환
```

## 매직 바이트 시그니처

| 파일 타입 | 매직 바이트 |
|----------|------------|
| PDF | 25 50 44 46 |
| PNG | 89 50 4E 47 |
| JPG | FF D8 FF |
| ZIP | 50 4B 03 04 |
| DOCX | 50 4B 03 04 (+ ZIP) |

## Session Guide
- `src/file-upload.ts` → `src/index.ts` → `tests/file-upload.test.ts`
- Design Anchor: `// Design Ref: SVC-FILEUP-R34 DESIGN`
