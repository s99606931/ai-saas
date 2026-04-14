/**
 * DS-MOL-R2 — DataTable 단위 테스트
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataTable, type DataTableColumn } from './index.js';

interface User {
  id: string;
  name: string;
  email: string;
  age: number;
}

const users: User[] = [
  { id: '1', name: '홍길동', email: 'hong@gov.kr', age: 30 },
  { id: '2', name: '김철수', email: 'kim@gov.kr', age: 25 },
  { id: '3', name: '이영희', email: 'lee@gov.kr', age: 35 },
];

const columns: DataTableColumn<User>[] = [
  { key: 'name', header: '이름', sortable: true },
  { key: 'email', header: '이메일' },
  { key: 'age', header: '나이', sortable: true, align: 'right' },
];

describe('DataTable', () => {
  it('renders table with data', () => {
    render(<DataTable data={users} columns={columns} rowKey="id" />);
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('홍길동')).toBeInTheDocument();
    expect(screen.getByText('kim@gov.kr')).toBeInTheDocument();
  });

  it('renders column headers with scope=col', () => {
    render(<DataTable data={users} columns={columns} rowKey="id" />);
    expect(screen.getByRole('columnheader', { name: /이름/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '이메일' })).toBeInTheDocument();
  });

  it('shows empty message when no data', () => {
    render(
      <DataTable
        data={[]}
        columns={columns}
        rowKey="id"
        emptyMessage="사용자가 없습니다"
      />
    );
    expect(screen.getByText('사용자가 없습니다')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(<DataTable data={[]} columns={columns} rowKey="id" loading />);
    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText(/불러오는 중/)).toBeInTheDocument();
  });

  it('sets aria-sort on sortable columns', () => {
    render(
      <DataTable
        data={users}
        columns={columns}
        rowKey="id"
        sortKey="name"
        sortDirection="asc"
      />
    );
    const nameHeader = screen.getByRole('columnheader', { name: /이름/ });
    expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
  });

  it('calls onSort when sortable header clicked', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    render(
      <DataTable data={users} columns={columns} rowKey="id" onSort={onSort} />
    );
    await user.click(screen.getByRole('button', { name: /이름/ }));
    expect(onSort).toHaveBeenCalledWith('name', 'asc');
  });

  it('toggles sort direction on repeated click', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    render(
      <DataTable
        data={users}
        columns={columns}
        rowKey="id"
        sortKey="name"
        sortDirection="asc"
        onSort={onSort}
      />
    );
    await user.click(screen.getByRole('button', { name: /이름/ }));
    expect(onSort).toHaveBeenCalledWith('name', 'desc');
  });

  it('handles multi selection', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        data={users}
        columns={columns}
        rowKey="id"
        selection={{
          mode: 'multi',
          selectedKeys: [],
          onSelectionChange,
        }}
      />
    );
    const firstRowCheckbox = screen.getByRole('checkbox', { name: '행 1 선택' });
    await user.click(firstRowCheckbox);
    expect(onSelectionChange).toHaveBeenCalledWith(['1']);
  });

  it('select-all toggles all rows', async () => {
    const user = userEvent.setup();
    const onSelectionChange = vi.fn();
    render(
      <DataTable
        data={users}
        columns={columns}
        rowKey="id"
        selection={{
          mode: 'multi',
          selectedKeys: [],
          onSelectionChange,
        }}
      />
    );
    await user.click(screen.getByRole('checkbox', { name: '모두 선택' }));
    expect(onSelectionChange).toHaveBeenCalledWith(['1', '2', '3']);
  });

  it('renders pagination controls', () => {
    render(
      <DataTable
        data={users}
        columns={columns}
        rowKey="id"
        pagination={{
          page: 2,
          pageSize: 3,
          total: 10,
          onPageChange: vi.fn(),
        }}
      />
    );
    expect(screen.getByText(/총 10건/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '이전 페이지' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다음 페이지' })).toBeInTheDocument();
  });

  it('disables prev on first page', () => {
    render(
      <DataTable
        data={users}
        columns={columns}
        rowKey="id"
        pagination={{
          page: 1,
          pageSize: 3,
          total: 10,
          onPageChange: vi.fn(),
        }}
      />
    );
    expect(screen.getByRole('button', { name: '이전 페이지' })).toBeDisabled();
  });

  it('uses render function for custom cell', () => {
    const customColumns: DataTableColumn<User>[] = [
      {
        key: 'name',
        header: '이름',
        render: (value) => <strong>[{String(value)}]</strong>,
      },
    ];
    render(<DataTable data={users} columns={customColumns} rowKey="id" />);
    expect(screen.getByText('[홍길동]')).toBeInTheDocument();
  });
});
