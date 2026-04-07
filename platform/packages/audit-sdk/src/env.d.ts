// Node.js 글로벌 타입 선언 (audit-sdk는 @types/node 미설치)
// Design Ref: DESIGN-MTU-P13
// NOTE: 런타임은 Node.js 환경에서만 실행됨

declare const process: {
  stdout: { write: (str: string) => boolean };
  stderr: { write: (str: string) => boolean };
  env: Record<string, string | undefined>;
};
