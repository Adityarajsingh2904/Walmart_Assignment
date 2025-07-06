import React, { useMemo, useRef, useState } from 'react';
import { ResponsiveContainer } from 'recharts';
import { differenceInCalendarWeeks, parseISO } from 'date-fns';

export type DayData = {
  date: string; // YYYY-MM-DD
  low: number;
  medium: number;
  high: number;
};

export interface SeverityHeatmapProps {
  data: DayData[]; // past 30 days, unsorted
}

function colorClass(high: number): string {
  if (high === 0) return 'fill-gray-200 dark:fill-gray-700';
  if (high <= 3) return 'fill-red-200 dark:fill-red-800';
  if (high <= 6) return 'fill-red-400 dark:fill-red-600';
  return 'fill-red-600 dark:fill-red-400';
}

interface CellProps {
  x: number;
  y: number;
  size: number;
  day: DayData;
  onHover: (e: React.MouseEvent<SVGRectElement>, day: DayData) => void;
  onLeave: () => void;
}

const Cell = React.memo(function Cell({ x, y, size, day, onHover, onLeave }: CellProps) {
  const strokeNeeded = day.low + day.medium + day.high > 0;
  const strokeClass = strokeNeeded ? 'stroke-current text-gray-400 dark:text-gray-500' : '';
  return (
    <rect
      x={x}
      y={y}
      width={size}
      height={size}
      className={`${colorClass(day.high)} ${strokeClass}`}
      strokeWidth={strokeNeeded ? 1 : 0}
      onMouseEnter={(e) => onHover(e, day)}
      onMouseLeave={onLeave}
    />
  );
});

export default function SeverityHeatmap({ data }: SeverityHeatmapProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; day: DayData } | null>(null);

  const cells = useMemo(() => {
    const today = new Date();
    return data.map((d) => {
      const date = parseISO(d.date);
      return {
        ...d,
        row: date.getDay(),
        col: differenceInCalendarWeeks(today, date),
      };
    });
  }, [data]);

  const maxCol = useMemo(() => Math.max(0, ...cells.map((c) => c.col)), [cells]);

  const handleHover = (e: React.MouseEvent<SVGRectElement>, day: DayData) => {
    const rect = containerRef.current?.getBoundingClientRect();
    setTooltip({
      x: e.clientX - (rect?.left ?? 0) + 8,
      y: e.clientY - (rect?.top ?? 0) + 8,
      day,
    });
  };
  const handleLeave = () => setTooltip(null);

  return (
    <div ref={containerRef} className="relative">
      <ResponsiveContainer width="100%" height={200}>
        {({ width, height }) => {
          const cell = Math.min(width / (maxCol + 1), height / 7);
          return (
            <svg width={width} height={height}>
              {cells.map((c) => (
                <Cell
                  key={c.date}
                  x={(maxCol - c.col) * cell}
                  y={c.row * cell}
                  size={cell - 2}
                  day={c}
                  onHover={handleHover}
                  onLeave={handleLeave}
                />
              ))}
            </svg>
          );
        }}
      </ResponsiveContainer>
      {tooltip && (
        <div
          className="absolute pointer-events-none text-xs bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 rounded px-2 py-1 shadow"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          {`${tooltip.day.date} — Low: ${tooltip.day.low}, Medium: ${tooltip.day.medium}, High: ${tooltip.day.high}`}
        </div>
      )}
      <div className="flex gap-3 mt-2 text-xs items-center">
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-gray-200 dark:bg-gray-700 inline-block" />
          0
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red-200 dark:bg-red-800 inline-block" />
          1–3
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red-400 dark:bg-red-600 inline-block" />
          4–6
        </div>
        <div className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red-600 dark:bg-red-400 inline-block" />
          7+
        </div>
      </div>
    </div>
  );
}
