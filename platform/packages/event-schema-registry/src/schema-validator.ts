// JSON Schema subset validator
// Plan SC: FR-ESR.3, FR-ESR.7

export interface PrimitiveSchema {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array';
  enum?: unknown[];
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  items?: Schema;
}

export interface ObjectSchema {
  type: 'object';
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean;
}

export type Schema = PrimitiveSchema | ObjectSchema;

export interface ValidationError {
  path: string;
  message: string;
}

export class EventSchemaError extends Error {
  public readonly errors: ValidationError[];
  constructor(errors: ValidationError[]) {
    super(
      `Schema validation failed (${errors.length} error${errors.length > 1 ? 's' : ''}): ${errors[0]?.message ?? ''}`,
    );
    this.name = 'EventSchemaError';
    this.errors = errors;
  }
}

export function validate(schema: Schema, value: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  validateInternal(schema, value, '', errors);
  return errors;
}

function validateInternal(
  schema: Schema,
  value: unknown,
  path: string,
  errors: ValidationError[],
): void {
  if (schema.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      errors.push({ path: path || '$', message: `expected object` });
      return;
    }
    const obj = value as Record<string, unknown>;

    if (schema.required) {
      for (const key of schema.required) {
        if (!(key in obj)) {
          errors.push({
            path: pathJoin(path, key),
            message: `required field missing`,
          });
        }
      }
    }

    if (schema.properties) {
      for (const [key, subSchema] of Object.entries(schema.properties)) {
        if (key in obj) {
          validateInternal(subSchema, obj[key], pathJoin(path, key), errors);
        }
      }
    }

    if (schema.additionalProperties === false && schema.properties) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(obj)) {
        if (!allowed.has(key)) {
          errors.push({
            path: pathJoin(path, key),
            message: `additional property not allowed`,
          });
        }
      }
    }
    return;
  }

  if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      errors.push({ path: path || '$', message: 'expected array' });
      return;
    }
    if (schema.items) {
      for (let i = 0; i < value.length; i += 1) {
        validateInternal(schema.items, value[i], `${path}[${i}]`, errors);
      }
    }
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({ path: path || '$', message: 'value not in enum' });
    }
    return;
  }

  if (schema.type === 'string') {
    if (typeof value !== 'string') {
      errors.push({ path: path || '$', message: 'expected string' });
      return;
    }
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        path: path || '$',
        message: `string length ${value.length} < minLength ${schema.minLength}`,
      });
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        path: path || '$',
        message: `string length ${value.length} > maxLength ${schema.maxLength}`,
      });
    }
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({ path: path || '$', message: 'value not in enum' });
    }
    return;
  }

  if (schema.type === 'number' || schema.type === 'integer') {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      errors.push({ path: path || '$', message: `expected ${schema.type}` });
      return;
    }
    if (schema.type === 'integer' && !Number.isInteger(value)) {
      errors.push({ path: path || '$', message: 'expected integer' });
    }
    if (schema.minimum !== undefined && value < schema.minimum) {
      errors.push({
        path: path || '$',
        message: `value ${value} < minimum ${schema.minimum}`,
      });
    }
    if (schema.maximum !== undefined && value > schema.maximum) {
      errors.push({
        path: path || '$',
        message: `value ${value} > maximum ${schema.maximum}`,
      });
    }
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push({ path: path || '$', message: 'value not in enum' });
    }
    return;
  }

  if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') {
      errors.push({ path: path || '$', message: 'expected boolean' });
    }
  }
}

function pathJoin(parent: string, child: string): string {
  return parent ? `${parent}.${child}` : child;
}
