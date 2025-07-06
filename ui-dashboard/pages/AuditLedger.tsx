import React from 'react';
import { useInfiniteQuery } from 'react-query';
import { Table, Button, Toast } from 'shadcn/ui';
import {
  ColumnDef,
  getCoreRowModel,
  flexRender,
  useReactTable,
} from '@tanstack/react-table';

export interface LogEntry {
  id: string;
  timestamp: string; // ISO
  action: string;
  hash: string;
  details: string;
}

function throttle<T extends (...args: any[]) => void>(fn: T, delay: number) {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - last >= delay) {
      last = now;
      fn(...args);
    } else {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        last = Date.now();
        fn(...args);
      }, delay - (now - last));
    }
  };
}

function ArrayToCSV<T extends Record<string, any>>(rows: T[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = rows.map((r) =>
    headers
      .map((h) => JSON.stringify(r[h] ?? ''))
      .join(',')
  );
  return [headers.join(','), ...lines].join('\n');
}

export default function AuditLedger(): JSX.Element {
  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [toast, setToast] = React.useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const csvRef = React.useRef<HTMLAnchorElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const query = useInfiniteQuery(
    'ledger',
    ({ pageParam }) =>
      fetch(`/api/ledger?cursor=${pageParam ?? ''}`).then((res) => res.json()),
    {
      getNextPageParam: (last) => last.nextCursor,
    }
  );

  const data = React.useMemo(
    () => query.data?.pages.flatMap((p: { data: LogEntry[] }) => p.data) ?? [],
    [query.data]
  );

  const verify = React.useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/ledger/verify/${id}`);
      if (!res.ok) throw new Error('verify failed');
      setToast({ type: 'success', message: 'Verified' });
    } catch {
      setToast({ type: 'error', message: 'Verification failed' });
    }
  }, []);

  const columns = React.useMemo<ColumnDef<LogEntry>[]>(
    () => [
      {
        accessorKey: 'timestamp',
        header: 'Time',
        cell: ({ getValue }) => new Date(getValue() as string).toLocaleString(),
      },
      { accessorKey: 'action', header: 'Action' },
      {
        accessorKey: 'hash',
        header: 'Hash',
        cell: ({ getValue }) => (
          <span className="break-all">{getValue() as string}</span>
        ),
      },
      {
        id: 'verify',
        header: 'Verify',
        cell: ({ row }) => (
          <Button size="sm" onClick={() => verify(row.original.id)}>
            Verify
          </Button>
        ),
      },
      {
        id: 'expand',
        header: '',
        cell: ({ row }) => (
          <button
            aria-label="Toggle details"
            onClick={() =>
              setExpanded((e) => ({ ...e, [row.original.id]: !e[row.original.id] }))
            }
          >
            {expanded[row.original.id] ? '▼' : '▶'}
          </button>
        ),
      },
    ],
    [expanded, verify]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleScroll = React.useMemo(
    () =>
      throttle(() => {
        const el = containerRef.current;
        if (!el || query.isFetchingNextPage || !query.hasNextPage) return;
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 20) {
          query.fetchNextPage();
        }
      }, 300),
    [query]
  );

  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', handleScroll);
    return () => el.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const exportCsv = () => {
    const rows = table.getRowModel().rows.map((r) => r.original);
    const csv = ArrayToCSV(rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = csvRef.current;
    if (link) {
      link.href = url;
      link.download = 'ledger.csv';
      link.click();
      URL.revokeObjectURL(url);
    }
  };

  const LedgerRow = React.useMemo(
    () =>
      React.memo(function LedgerRow({ row }: { row: typeof table.getRowModel()['rows'][number] }) {
        return (
          <React.Fragment key={row.id}>
            <tr>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id} className="p-2 align-top">
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
            {expanded[row.original.id] && (
              <tr>
                <td colSpan={row.getVisibleCells().length} className="p-2 bg-gray-50 dark:bg-gray-800">
                  <pre className="whitespace-pre-wrap text-sm">
                    {row.original.details}
                  </pre>
                </td>
              </tr>
            )}
          </React.Fragment>
        );
      }),
    [expanded, table]
  );

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-end">
        <Button onClick={exportCsv}>Export CSV</Button>
        <a ref={csvRef} style={{ display: 'none' }} />
      </div>
      <div ref={containerRef} className="overflow-auto max-h-[70vh]">
        <Table className="w-full">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} className="text-left p-2">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <LedgerRow key={row.id} row={row} />
            ))}
            {query.isFetchingNextPage && (
              <tr>
                <td colSpan={columns.length} className="p-2 text-center">
                  Loading...
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>
      {toast && (
        <Toast
          open={true}
          onOpenChange={() => setToast(null)}
          variant={toast.type}
        >
          {toast.message}
        </Toast>
      )}
    </div>
  );
}

