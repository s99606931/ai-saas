// Design Ref: MTU-ECO3 Design 2.2
// Plan SC: FR-ECO3.6
import { z } from 'zod';

/**
 * 데이터셋 검색 스키마
 * CSAP D-12: 모든 입력 Zod 검증
 */
export const datasetSearchSchema = z.object({
  keyword: z.string().min(1).max(100).optional(),
  category: z
    .enum(['general', 'economy', 'society', 'education', 'health', 'environment', 'transportation', 'culture'])
    .optional(),
  format: z.enum(['json', 'xml', 'csv']).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * 데이터 변환 스키마
 */
export const transformSchema = z.object({
  data: z.string().min(1, '변환할 데이터가 필요합니다'),
  sourceFormat: z.enum(['xml', 'csv']),
  targetFormat: z.enum(['json']).default('json'),
  encoding: z.enum(['utf-8', 'euc-kr']).default('utf-8'),
});

export type DatasetSearch = z.infer<typeof datasetSearchSchema>;
export type TransformRequest = z.infer<typeof transformSchema>;
