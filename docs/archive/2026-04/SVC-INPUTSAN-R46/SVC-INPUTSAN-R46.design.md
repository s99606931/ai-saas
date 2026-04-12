# SVC-INPUTSAN-R46 Design — 입력 새니타이저

## 모듈 구조

```
platform/packages/input-sanitizer/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts
│   ├── html.ts        # escapeHtml, escapeAttribute
│   ├── filename.ts    # safeFilename
│   ├── path.ts        # containPath
│   ├── url.ts         # isSafeUrl, isPrivateIp
│   └── text.ts        # stripControlChars, truncate
└── tests/
    └── input-sanitizer.test.ts
```

## 알고리즘

### escapeHtml
```
'&' → '&amp;' (먼저)
'<' → '&lt;'
'>' → '&gt;'
'"' → '&quot;'
"'" → '&#39;'
'/' → '&#x2F;'
```

### escapeAttribute
escapeHtml + `=` → `&#x3D;`, `\`` → `&#x60;`

### safeFilename
```
1. NFC 정규화
2. NUL(\u0000) 제거
3. 제어문자(\u0000-\u001F, \u007F) 제거
4. 경로 구분자(/, \) 제거
5. '..' 시퀀스를 '_'로 치환
6. 선행 '.' 제거 (숨김 파일 방지)
7. Windows 예약어 (CON, PRN, AUX, NUL, COM1-9, LPT1-9) → '_' 접미
8. 최대 길이 255 (확장자 보존)
```

### containPath(base, target)
```
import { resolve, relative, isAbsolute, sep } from 'node:path'
absBase = resolve(base)
absTarget = resolve(absBase, target)
rel = relative(absBase, absTarget)
return !rel.startsWith('..') && !isAbsolute(rel)
```

### isSafeUrl(url, opts)
```
1. URL 파싱 시도, 실패 → false
2. scheme이 opts.allowedSchemes (default: ['http','https'])에 없으면 false
3. opts.allowedHosts 지정 시 host 매칭 확인
4. opts.blockPrivate (default true): isPrivateIp(host) → false
5. true
```

### isPrivateIp(host)
```
- 'localhost', '127.x.x.x', '::1' → true
- RFC1918: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16 → true
- 169.254.0.0/16 (link-local), 100.64.0.0/10 (CGNAT) → true
- IPv6 fc00::/7, fe80::/10 → true
- 그 외 → false
```

## 테스트 계획 (20+)

| # | 케이스 | FR |
|---|--------|----|
| 1 | escapeHtml 6종 메타문자 | FR-IS.1 |
| 2 | escapeHtml `<script>` 페이로드 | FR-IS.1 |
| 3 | escapeHtml 빈 문자열 | FR-IS.1 |
| 4 | escapeAttribute = 변환 | FR-IS.2 |
| 5 | safeFilename `../etc/passwd` → 안전 | FR-IS.3 |
| 6 | safeFilename NUL 바이트 제거 | FR-IS.3 |
| 7 | safeFilename Windows CON 예약어 | FR-IS.3 |
| 8 | safeFilename 길이 255 제한 | FR-IS.3 |
| 9 | containPath base 하위 → true | FR-IS.4 |
| 10 | containPath `../` 탈출 → false | FR-IS.4 |
| 11 | containPath 절대경로 탈출 → false | FR-IS.4 |
| 12 | isSafeUrl https → true | FR-IS.5 |
| 13 | isSafeUrl javascript: → false | FR-IS.5 |
| 14 | isSafeUrl file:/// → false | FR-IS.5 |
| 15 | isSafeUrl 로컬IP 차단 | FR-IS.5 |
| 16 | isSafeUrl allowedHosts 화이트리스트 | FR-IS.5 |
| 17 | stripControlChars NUL 제거 | FR-IS.6 |
| 18 | stripControlChars CRLF 옵션 보존 | FR-IS.6 |
| 19 | truncate 한글 안전 | FR-IS.7 |
| 20 | isPrivateIp 192.168.x | FR-IS.8 |
| 21 | isPrivateIp 8.8.8.8 → false | FR-IS.8 |
| 22 | isPrivateIp ::1 → true | FR-IS.8 |
