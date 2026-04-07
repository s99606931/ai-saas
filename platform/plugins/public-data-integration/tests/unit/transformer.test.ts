// 공공데이터 연동 플러그인 데이터 변환 유틸리티 테스트
// Design Ref: MTU-ECO3 Design 2.2
// Plan SC: FR-ECO3.8
// CSAP: D-12 시스템 개발 보안 -- 입력 검증 및 변환 무결성

import { describe, it, expect } from 'vitest';
import { csvToJson, xmlToJson, transformData } from '../../src/lib/transformer';

describe('csvToJson (CSV -> JSON 변환)', () => {
  it('기본 CSV 데이터를 JSON으로 변환한다', () => {
    const csv = 'name,age,city\n홍길동,30,서울\n이순신,45,부산';
    const result = csvToJson(csv);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: '홍길동', age: '30', city: '서울' });
    expect(result[1]).toEqual({ name: '이순신', age: '45', city: '부산' });
  });

  it('쌍따옴표로 감싼 값을 올바르게 파싱한다', () => {
    const csv = '"name","value"\n"서울시","1000"';
    const result = csvToJson(csv);
    expect(result[0]).toEqual({ name: '서울시', value: '1000' });
  });

  it('커스텀 구분자를 지원한다', () => {
    const tsv = 'name\tvalue\n서울시\t1000';
    const result = csvToJson(tsv, '\t');
    expect(result[0]).toEqual({ name: '서울시', value: '1000' });
  });

  it('빈 값을 빈 문자열로 처리한다', () => {
    const csv = 'a,b,c\n1,,3';
    const result = csvToJson(csv);
    expect(result[0]).toEqual({ a: '1', b: '', c: '3' });
  });

  it('헤더만 있고 데이터가 없으면 에러를 발생시킨다', () => {
    const csv = 'name,age';
    expect(() => csvToJson(csv)).toThrow('최소 1개의 데이터 행이 필요');
  });

  it('빈 CSV는 에러를 발생시킨다', () => {
    expect(() => csvToJson('')).toThrow();
  });

  it('공백 문자를 트림 처리한다', () => {
    const csv = ' name , age \n 서울 , 100 ';
    const result = csvToJson(csv);
    expect(result[0]).toEqual({ name: '서울', age: '100' });
  });

  it('여러 행을 올바르게 처리한다', () => {
    const csv = 'id,name\n1,서울\n2,부산\n3,대구\n4,인천\n5,광주';
    const result = csvToJson(csv);
    expect(result).toHaveLength(5);
    expect(result[4]).toEqual({ id: '5', name: '광주' });
  });
});

describe('xmlToJson (XML -> JSON 변환)', () => {
  it('기본 XML 데이터를 JSON으로 변환한다', () => {
    const xml = `
      <items>
        <item>
          <name>서울특별시</name>
          <population>9776000</population>
        </item>
        <item>
          <name>부산광역시</name>
          <population>3404000</population>
        </item>
      </items>
    `;
    const result = xmlToJson(xml);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ name: '서울특별시', population: '9776000' });
    expect(result[1]).toEqual({ name: '부산광역시', population: '3404000' });
  });

  it('단일 item을 올바르게 파싱한다', () => {
    const xml = '<items><item><id>1</id></item></items>';
    const result = xmlToJson(xml);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ id: '1' });
  });

  it('빈 XML에서 빈 배열을 반환한다', () => {
    const result = xmlToJson('<items></items>');
    expect(result).toHaveLength(0);
  });

  it('item 태그가 없는 XML에서 빈 배열을 반환한다', () => {
    const result = xmlToJson('<root><data>test</data></root>');
    expect(result).toHaveLength(0);
  });

  it('여러 필드가 있는 item을 올바르게 파싱한다', () => {
    const xml = `
      <items>
        <item>
          <id>1</id>
          <name>테스트</name>
          <category>일반</category>
          <format>json</format>
        </item>
      </items>
    `;
    const result = xmlToJson(xml);
    expect(result[0]).toEqual({
      id: '1',
      name: '테스트',
      category: '일반',
      format: 'json',
    });
  });

  it('빈 필드 값을 빈 문자열로 처리한다', () => {
    const xml = '<items><item><name></name></item></items>';
    const result = xmlToJson(xml);
    expect(result[0]).toEqual({ name: '' });
  });
});

describe('transformData (통합 변환 함수)', () => {
  it('CSV 소스를 JSON으로 변환한다', () => {
    const csv = 'a,b\n1,2';
    const result = transformData(csv, 'csv');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ a: '1', b: '2' });
  });

  it('XML 소스를 JSON으로 변환한다', () => {
    const xml = '<items><item><a>1</a></item></items>';
    const result = transformData(xml, 'xml');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ a: '1' });
  });

  it('targetFormat을 json으로 명시할 수 있다', () => {
    const csv = 'a\n1';
    const result = transformData(csv, 'csv', 'json');
    expect(result).toHaveLength(1);
  });

  it('지원하지 않는 대상 형식에 에러를 발생시킨다', () => {
    // @ts-expect-error: 의도적으로 잘못된 타입 전달
    expect(() => transformData('data', 'csv', 'xml')).toThrow('지원하지 않는 대상 형식');
  });

  it('지원하지 않는 소스 형식에 에러를 발생시킨다', () => {
    // @ts-expect-error: 의도적으로 잘못된 타입 전달
    expect(() => transformData('data', 'yaml')).toThrow('지원하지 않는 소스 형식');
  });
});
