---
sidebar_position: 1
---

# 플러그인 개발 가이드

자세한 내용은 `docs/framework/05-ecosystem/plugin-development-guide.md`를 참조하세요.

## 플러그인 구조

```
platform/plugins/my-plugin/
├── package.json
├── src/
│   ├── index.ts         # 진입점
│   ├── manifest.ts      # ServiceManifest
│   ├── routes.ts        # 라우트 등록
│   ├── handlers/        # API 핸들러
│   ├── lib/             # 비즈니스 로직
│   └── schemas/         # Zod 스키마
└── README.md
```

## 보안 필수 사항

- CSAP D-08: 모든 API에 RBAC 검사 필수
- CSAP D-12: 모든 입력에 Zod 스키마 검증 필수
- 감사 로그: 민감 작업 전수 기록 필수
