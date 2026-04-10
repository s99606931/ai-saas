// Design Ref: MTU-ECO3 Design 2.2
// Plan SC: FR-ECO3.8

/**
 * 데이터 변환 유틸리티
 * XML -> JSON, CSV -> JSON 변환 지원
 */

/**
 * CSV -> JSON 변환
 * 첫 행을 헤더로 사용
 */
export function csvToJson(csvData: string, delimiter: string = ','): Record<string, string>[] {
  const lines = csvData.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV 데이터에 헤더와 최소 1개의 데이터 행이 필요합니다');
  }

  const headers = lines[0].split(delimiter).map((h) => h.trim().replace(/^"(.*)"$/, '$1'));
  const result: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter).map((v) => v.trim().replace(/^"(.*)"$/, '$1'));
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] || '';
    }
    result.push(row);
  }

  return result;
}

/**
 * 간이 XML -> JSON 변환
 * 공공데이터포털에서 제공하는 단순 XML 구조에 최적화
 *
 * 지원 형식:
 * <items>
 *   <item>
 *     <field1>value1</field1>
 *     <field2>value2</field2>
 *   </item>
 * </items>
 */
export function xmlToJson(xmlData: string): Record<string, string>[] {
  const result: Record<string, string>[] = [];

  // <item> 태그 추출
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch: RegExpExecArray | null;

  while ((itemMatch = itemRegex.exec(xmlData)) !== null) {
    const itemContent = itemMatch[1];
    const row: Record<string, string> = {};

    // 개별 필드 추출
    const fieldRegex = /<(\w+)>([\s\S]*?)<\/\1>/g;
    let fieldMatch: RegExpExecArray | null;

    while ((fieldMatch = fieldRegex.exec(itemContent)) !== null) {
      const key = fieldMatch[1];
      const value = fieldMatch[2].trim();
      row[key] = value;
    }

    if (Object.keys(row).length > 0) {
      result.push(row);
    }
  }

  return result;
}

/**
 * 데이터 변환 통합 함수
 */
export function transformData(
  data: string,
  sourceFormat: 'xml' | 'csv',
  targetFormat: 'json' = 'json',
): Record<string, string>[] {
  if (targetFormat !== 'json') {
    throw new Error(`지원하지 않는 대상 형식: ${targetFormat}`);
  }

  switch (sourceFormat) {
    case 'csv':
      return csvToJson(data);
    case 'xml':
      return xmlToJson(data);
    default:
      throw new Error(`지원하지 않는 소스 형식: ${sourceFormat}`);
  }
}
