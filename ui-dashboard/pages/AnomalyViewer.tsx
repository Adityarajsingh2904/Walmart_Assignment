import React, { useState, useEffect, useCallback } from 'react';
import { useQuery } from 'react-query';
import { Table, Input, Panel } from 'shadcn/ui';
import { ResponsiveContainer, LineChart, Line } from 'recharts';
import { format } from 'date-fns';

interface Anomaly {
  id: string;
  timestamp: string; // ISO
  scoreHistory: number[]; // last 20 points
  gptExplanation: string;
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debounced;
}

export default function AnomalyViewer(): JSX.Element {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Anomaly | null>(null);

  const debounced = useDebounce(search, 300);

  const {
    data,
    isLoading,
    isError,
    refetch,
  } = useQuery<Anomaly[]>(['/api/alerts', debounced, page, pageSize], () =>
    fetch(`/api/alerts?search=${debounced}&page=${page}&pageSize=${pageSize}`)
      .then((res) => res.json())
  );

  const handleRowClick = (a: Anomaly) => setSelected(a);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTableRowElement>, idx: number) => {
      if (!data) return;
      if (e.key === 'ArrowDown' && idx < data.length - 1) {
        setSelected(data[idx + 1]);
      } else if (e.key === 'ArrowUp' && idx > 0) {
        setSelected(data[idx - 1]);
      }
    },
    [data]
  );

  useEffect(() => {
    if (data && !selected && data.length) {
      setSelected(data[0]);
    }
  }, [data, selected]);

  return (
    <div className="p-4 space-y-4">
      <Input
        placeholder="Search anomalies"
        value={search}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
      />
      <div className="flex gap-4">
        <div className="flex-1 overflow-auto">
          <Table className="w-full">
            <caption className="text-left font-semibold mb-2">Anomaly Alerts</caption>
            <thead>
              <tr>
                <th scope="col" className="text-left p-2">Time</th>
                <th scope="col" className="text-left p-2">ID</th>
                <th scope="col" className="text-left p-2">Anomaly Score</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={3} className="p-4 text-center">Loading...</td>
                </tr>
              )}
              {isError && (
                <tr>
                  <td colSpan={3} className="p-4 text-red-600">Failed to load</td>
                </tr>
              )}
              {data?.map((a, idx) => (
                <tr
                  key={a.id}
                  className={`cursor-pointer ${
                    selected?.id === a.id ? 'bg-blue-50 dark:bg-gray-700' : idx % 2 ? 'bg-gray-50 dark:bg-gray-800' : ''
                  }`}
                  tabIndex={0}
                  onClick={() => handleRowClick(a)}
                  onKeyDown={(e) => handleKeyDown(e, idx)}
                >
                  <td className="p-2">{format(new Date(a.timestamp), 'PPpp')}</td>
                  <td className="p-2">{a.id}</td>
                  <td className="p-2">{a.scoreHistory[a.scoreHistory.length - 1].toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="flex justify-between items-center mt-2">
            <button
              className="px-2 py-1 border rounded"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Prev
            </button>
            <span>
              Page {page}
            </span>
            <button
              className="px-2 py-1 border rounded"
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
        <Panel className="w-80 h-[300px] overflow-y-auto p-4 space-y-4">
          {selected ? (
            <>
              <ResponsiveContainer width="100%" height={40}>
                <LineChart data={selected.scoreHistory.map((y, i) => ({ i, y }))}>
                  <Line type="monotone" dataKey="y" stroke="#2563eb" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
              <div className="whitespace-pre-wrap text-sm">
                {selected.gptExplanation}
              </div>
            </>
          ) : (
            <div className="text-gray-500">Select a row to see details</div>
          )}
        </Panel>
      </div>
    </div>
  );
}
