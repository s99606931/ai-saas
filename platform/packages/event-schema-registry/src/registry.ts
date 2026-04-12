// Schema Registry
// Plan SC: FR-ESR.1, FR-ESR.5, FR-ESR.6, FR-ESR.8

import {
  validate,
  EventSchemaError,
  type Schema,
  type ValidationError,
} from './schema-validator.js';
import { compare, parse } from './semver.js';

export interface RegistryOptions {
  /** 미등록 이벤트 발행 시 예외 (default: true) */
  strict?: boolean;
}

interface SchemaEntry {
  type: string;
  version: string;
  schema: Schema;
  registeredAt: number;
}

export class SchemaRegistry {
  private readonly entries = new Map<string, SchemaEntry>();
  private readonly strict: boolean;

  constructor(options: RegistryOptions = {}) {
    this.strict = options.strict ?? true;
  }

  /**
   * 이벤트 스키마 등록
   * Plan SC: FR-ESR.1
   */
  register(eventType: string, version: string, schema: Schema): void {
    if (!eventType) throw new Error('eventType is required');
    parse(version); // semver 형식 검증
    const key = this.key(eventType, version);
    if (this.entries.has(key)) {
      throw new Error(
        `Schema already registered: ${eventType}@${version}`,
      );
    }
    this.entries.set(key, {
      type: eventType,
      version,
      schema,
      registeredAt: Date.now(),
    });
  }

  /**
   * 특정 버전 스키마 조회
   */
  get(eventType: string, version: string): Schema | undefined {
    return this.entries.get(this.key(eventType, version))?.schema;
  }

  /**
   * 최신 버전 조회
   * Plan SC: FR-ESR.5
   */
  latest(eventType: string): { version: string; schema: Schema } | undefined {
    const versions: SchemaEntry[] = [];
    for (const entry of this.entries.values()) {
      if (entry.type === eventType) versions.push(entry);
    }
    if (versions.length === 0) return undefined;
    versions.sort((a, b) => compare(b.version, a.version));
    return { version: versions[0]!.version, schema: versions[0]!.schema };
  }

  /**
   * 등록된 이벤트 카탈로그
   * Plan SC: FR-ESR.6
   */
  listEvents(): Array<{ type: string; versions: string[] }> {
    const map = new Map<string, string[]>();
    for (const entry of this.entries.values()) {
      const arr = map.get(entry.type) ?? [];
      arr.push(entry.version);
      map.set(entry.type, arr);
    }
    const result: Array<{ type: string; versions: string[] }> = [];
    for (const [type, versions] of map.entries()) {
      versions.sort(compare);
      result.push({ type, versions });
    }
    result.sort((a, b) => a.type.localeCompare(b.type));
    return result;
  }

  /**
   * 페이로드 검증
   * Plan SC: FR-ESR.3, FR-ESR.7, FR-ESR.8
   */
  validate(eventType: string, version: string, payload: unknown): void {
    const schema = this.get(eventType, version);
    if (!schema) {
      if (this.strict) {
        throw new EventSchemaError([
          {
            path: '$',
            message: `No schema registered for ${eventType}@${version}`,
          },
        ]);
      }
      return;
    }
    const errors = validate(schema, payload);
    if (errors.length > 0) {
      throw new EventSchemaError(errors);
    }
  }

  /** 검증 결과를 예외 없이 반환 */
  tryValidate(
    eventType: string,
    version: string,
    payload: unknown,
  ): ValidationError[] {
    try {
      this.validate(eventType, version, payload);
      return [];
    } catch (err) {
      if (err instanceof EventSchemaError) return err.errors;
      throw err;
    }
  }

  size(): number {
    return this.entries.size;
  }

  private key(type: string, version: string): string {
    return `${type}@${version}`;
  }
}
