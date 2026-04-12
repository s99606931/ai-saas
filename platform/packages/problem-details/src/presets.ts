// 16종 표준 Problem Details 사전정의
// Plan SC: FR-PD.3, FR-PD.8

import { PROBLEM_BASE_URI, type ProblemDetails } from './types.js';
import { problem } from './builder.js';

interface PresetSpec {
  slug: string;
  status: number;
  title: string;
}

const PRESETS: Record<string, PresetSpec> = {
  badRequest: { slug: 'bad-request', status: 400, title: '잘못된 요청' },
  unauthorized: { slug: 'unauthorized', status: 401, title: '인증 필요' },
  forbidden: { slug: 'forbidden', status: 403, title: '권한 없음' },
  notFound: { slug: 'not-found', status: 404, title: '리소스를 찾을 수 없음' },
  methodNotAllowed: {
    slug: 'method-not-allowed',
    status: 405,
    title: '허용되지 않은 메서드',
  },
  conflict: { slug: 'conflict', status: 409, title: '자원 충돌' },
  gone: { slug: 'gone', status: 410, title: '리소스 영구 삭제됨' },
  preconditionFailed: {
    slug: 'precondition-failed',
    status: 412,
    title: '사전 조건 실패',
  },
  payloadTooLarge: {
    slug: 'payload-too-large',
    status: 413,
    title: '요청 본문 초과',
  },
  unsupportedMediaType: {
    slug: 'unsupported-media-type',
    status: 415,
    title: '지원하지 않는 미디어 타입',
  },
  unprocessable: { slug: 'unprocessable', status: 422, title: '처리 불가' },
  tooManyRequests: {
    slug: 'too-many-requests',
    status: 429,
    title: '요청 한도 초과',
  },
  internalError: {
    slug: 'internal-error',
    status: 500,
    title: '내부 서버 오류',
  },
  notImplemented: {
    slug: 'not-implemented',
    status: 501,
    title: '구현되지 않음',
  },
  badGateway: { slug: 'bad-gateway', status: 502, title: '게이트웨이 오류' },
  serviceUnavailable: {
    slug: 'service-unavailable',
    status: 503,
    title: '서비스 일시 중단',
  },
};

function makePreset(spec: PresetSpec) {
  return (detail?: string): ProblemDetails =>
    problem({
      type: `${PROBLEM_BASE_URI}/${spec.slug}`,
      title: spec.title,
      status: spec.status,
      detail,
    });
}

export const badRequest = makePreset(PRESETS.badRequest!);
export const unauthorized = makePreset(PRESETS.unauthorized!);
export const forbidden = makePreset(PRESETS.forbidden!);
export const notFound = makePreset(PRESETS.notFound!);
export const methodNotAllowed = makePreset(PRESETS.methodNotAllowed!);
export const conflict = makePreset(PRESETS.conflict!);
export const gone = makePreset(PRESETS.gone!);
export const preconditionFailed = makePreset(PRESETS.preconditionFailed!);
export const payloadTooLarge = makePreset(PRESETS.payloadTooLarge!);
export const unsupportedMediaType = makePreset(PRESETS.unsupportedMediaType!);
export const unprocessable = makePreset(PRESETS.unprocessable!);
export const tooManyRequests = makePreset(PRESETS.tooManyRequests!);
export const internalError = makePreset(PRESETS.internalError!);
export const notImplemented = makePreset(PRESETS.notImplemented!);
export const badGateway = makePreset(PRESETS.badGateway!);
export const serviceUnavailable = makePreset(PRESETS.serviceUnavailable!);

export const PRESET_LIST = Object.keys(PRESETS);
