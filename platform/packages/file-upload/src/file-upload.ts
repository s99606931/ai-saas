// File Upload Handler -- 파일 업로드 검증
// Design Ref: SVC-FILEUP-R34 DESIGN
// Plan SC: FR-FU.1, FR-FU.2, FR-FU.3, FR-FU.4, FR-FU.5, FR-FU.6
// CSAP: D-12 시스템 개발 보안 (파일 업로드 공격 방지)

import { createHash } from 'node:crypto';

/**
 * 파일 업로드 검증 옵션
 */
export interface FileUploadOptions {
  /** 최대 파일 크기 (바이트) */
  maxSizeBytes: number;
  /** 허용 MIME 타입 화이트리스트 */
  allowedMimeTypes: string[];
  /** 허용 확장자 화이트리스트 (점 포함, 예: '.pdf') */
  allowedExtensions?: string[];
}

/**
 * 업로드 파일 입력
 */
export interface UploadedFile {
  /** 원본 파일명 */
  filename: string;
  /** 신고된 MIME 타입 (클라이언트 헤더) */
  mimeType: string;
  /** 파일 내용 버퍼 */
  content: Buffer;
}

/**
 * 검증된 파일 메타데이터
 * Plan SC: FR-FU.6
 */
export interface ValidatedFile {
  /** 새니타이제이션된 안전 파일명 */
  sanitizedFilename: string;
  /** 확인된 MIME 타입 (매직 바이트 기반) */
  verifiedMimeType: string;
  /** 파일 크기 (바이트) */
  size: number;
  /** SHA-256 해시 (16진수) */
  sha256: string;
}

/**
 * 파일 업로드 에러
 */
export class FileUploadError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = 'FileUploadError';
  }
}

/**
 * 매직 바이트 시그니처
 * Plan SC: FR-FU.3
 */
const MAGIC_BYTES: Array<{ mimeType: string; signature: number[]; ext: string }> = [
  { mimeType: 'application/pdf', signature: [0x25, 0x50, 0x44, 0x46], ext: '.pdf' },
  { mimeType: 'image/png', signature: [0x89, 0x50, 0x4e, 0x47], ext: '.png' },
  { mimeType: 'image/jpeg', signature: [0xff, 0xd8, 0xff], ext: '.jpg' },
  { mimeType: 'image/gif', signature: [0x47, 0x49, 0x46, 0x38], ext: '.gif' },
  { mimeType: 'application/zip', signature: [0x50, 0x4b, 0x03, 0x04], ext: '.zip' },
  { mimeType: 'application/x-tar', signature: [0x75, 0x73, 0x74, 0x61, 0x72], ext: '.tar' },
];

/**
 * 파일 내용의 매직 바이트로 실제 MIME 타입을 탐지합니다.
 * Plan SC: FR-FU.3
 */
export function detectMimeTypeFromMagicBytes(content: Buffer): string | null {
  for (const { mimeType, signature } of MAGIC_BYTES) {
    if (content.length < signature.length) continue;

    let matches = true;
    for (let i = 0; i < signature.length; i++) {
      if (content[i] !== signature[i]) {
        matches = false;
        break;
      }
    }

    if (matches) return mimeType;
  }

  return null;
}

/**
 * 파일명을 안전하게 새니타이제이션합니다.
 * Plan SC: FR-FU.4
 *
 * CSAP D-12: 경로 순회 공격(../) 방지, 특수문자 제거
 */
export function sanitizeFilename(filename: string): string {
  // 경로 구분자 제거
  let sanitized = filename.replace(/[/\\]/g, '_');

  // 상위 경로 순회 시도 제거
  sanitized = sanitized.replace(/\.\./g, '_');

  // 숨김 파일 방지 (맨 앞 점 제거)
  sanitized = sanitized.replace(/^\.+/, '');

  // 제어 문자, null 문자 제거
  sanitized = sanitized.replace(/[\x00-\x1f\x7f]/g, '');

  // 위험한 특수 문자 제거 (파일명에 부적합)
  sanitized = sanitized.replace(/[<>:"|?*]/g, '_');

  // 공백은 밑줄로
  sanitized = sanitized.replace(/\s+/g, '_');

  // 너무 긴 파일명 잘라내기 (255자 제한)
  if (sanitized.length > 255) {
    const ext = sanitized.lastIndexOf('.');
    if (ext > 0) {
      const base = sanitized.slice(0, ext);
      const extension = sanitized.slice(ext);
      sanitized = base.slice(0, 255 - extension.length) + extension;
    } else {
      sanitized = sanitized.slice(0, 255);
    }
  }

  // 점과 밑줄만 남은 경우도 유효한 이름이 아님
  if (!sanitized || /^[._]+$/.test(sanitized)) {
    sanitized = 'unnamed';
  }

  return sanitized;
}

/**
 * 파일 확장자 추출
 */
function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx).toLowerCase() : '';
}

/**
 * SHA-256 해시 계산
 * Plan SC: FR-FU.5
 */
export function calculateSHA256(content: Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * 업로드된 파일을 검증합니다.
 *
 * CSAP D-12: 파일 업로드 공격 방지
 *   - 크기 제한 (DoS 방지)
 *   - MIME 화이트리스트 (악성 파일 차단)
 *   - 매직 바이트 검증 (확장자 위변조 방지)
 *   - 파일명 새니타이제이션 (경로 순회 방지)
 *
 * Plan SC: FR-FU.1~FR-FU.6
 */
export function validateFileUpload(
  file: UploadedFile,
  options: FileUploadOptions,
): ValidatedFile {
  // FR-FU.1: 크기 검증
  if (file.content.length > options.maxSizeBytes) {
    throw new FileUploadError(
      `파일 크기가 최대 허용 크기(${options.maxSizeBytes} 바이트)를 초과합니다: ${file.content.length} 바이트`,
      'FILE_TOO_LARGE',
    );
  }

  if (file.content.length === 0) {
    throw new FileUploadError('빈 파일은 허용되지 않습니다.', 'EMPTY_FILE');
  }

  // FR-FU.2: MIME 타입 화이트리스트
  if (!options.allowedMimeTypes.includes(file.mimeType)) {
    throw new FileUploadError(
      `허용되지 않은 MIME 타입입니다: ${file.mimeType}`,
      'DISALLOWED_MIME_TYPE',
    );
  }

  // FR-FU.3: 매직 바이트 검증 (확장자 위변조 방지)
  const detectedMime = detectMimeTypeFromMagicBytes(file.content);
  if (detectedMime && detectedMime !== file.mimeType) {
    throw new FileUploadError(
      `파일 내용이 신고된 MIME 타입과 일치하지 않습니다. 신고: ${file.mimeType}, 실제: ${detectedMime}`,
      'MIME_MISMATCH',
    );
  }

  // 확장자 검증
  if (options.allowedExtensions) {
    const ext = getExtension(file.filename);
    if (!options.allowedExtensions.includes(ext)) {
      throw new FileUploadError(
        `허용되지 않은 파일 확장자입니다: ${ext}`,
        'DISALLOWED_EXTENSION',
      );
    }
  }

  // FR-FU.4: 파일명 새니타이제이션
  const sanitizedFilename = sanitizeFilename(file.filename);

  // FR-FU.5: SHA-256 해시
  const sha256 = calculateSHA256(file.content);

  // FR-FU.6: 메타데이터 반환
  return {
    sanitizedFilename,
    verifiedMimeType: detectedMime ?? file.mimeType,
    size: file.content.length,
    sha256,
  };
}
