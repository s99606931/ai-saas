# SVC-AI-ADV-R99 — AutoDoc Generator Design

## 인터페이스

```typescript
export interface FunctionSignature {
  name: string;
  params: Array<{ name: string; type: string; optional: boolean }>;
  returnType: string;
  isAsync: boolean;
  isExported: boolean;
}

export interface JsDocBlock {
  functionName: string;
  comment: string;
}

export class AutoDocGenerator {
  parseSignature(source: string): FunctionSignature[];
  generateJsDoc(sig: FunctionSignature, description?: string): string;
  generateForFile(source: string): JsDocBlock[];
}
```

## 파서 (정규식 기반, 간소)

- `(export\s+)?(async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*:\s*([^{]+)`
- 매개변수: `name[?]:\s*type`
- 화살표 함수: `(export\s+)?const\s+(\w+)\s*=\s*(async\s*)?\(([^)]*)\)\s*:\s*([^=>]+)=>`

## JSDoc 템플릿

```
/**
 * {description 혹은 TODO}
 *
 * @param {type} name - 설명
 * @returns {type} 반환값 설명
 */
```

## 테스트

1. 단순 함수 파싱
2. 매개변수 optional 감지
3. async 함수 감지
4. JSDoc 생성 결과 검증
5. generateForFile 다중 함수 처리
