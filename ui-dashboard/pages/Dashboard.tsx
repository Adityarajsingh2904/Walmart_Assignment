import React, { useMemo } from 'react';
import {
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Card, Grid, Badge } from 'shadcn/ui';
import {
  ResponsiveContainer,
  HeatMap,
  RadialGauge,
  XAxis,
  Tooltip,
  YAxis,
} from 'recharts';
import {
  eachDayOfInterval,
  format,
  formatDistanceToNow,
  subDays,
} from 'date-fns';
import useWebSocket from '../hooks/useWebSocket';

interface Alert {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string;
}

interface Metrics {
  cpuUsage: number;
  memUsage: number;
  reqRate: number;
}

function severityVariant(severity: Alert['severity']): string {
  switch (severity) {
    case 'low':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
    case 'high':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
    default:
      return '';
  }
}

function IncidentCardsGrid({
  alerts,
  loading,
  error,
}: {
  alerts: Alert[];
  loading: boolean;
  error: unknown;
}) {
  if (loading) {
    return (
      <div className="flex justify-center items-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }
  if (error) {
    return (
      <Card className="bg-red-50 dark:bg-red-900 text-red-700 dark:text-red-300 p-4">
        Failed to load alerts
      </Card>
    );
  }
  const sorted = alerts
    .slice()
    .sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp))
    .slice(0, 6);
  return (
    <Grid className="gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((a) => (
        <Card key={a.id} className="p-4 space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-sm">{a.title}</h3>
            <Badge className={`${severityVariant(a.severity)} text-xs`}>{a.severity}</Badge>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {formatDistanceToNow(new Date(a.timestamp), { addSuffix: true })}
          </p>
        </Card>
      ))}
    </Grid>
  );
}

function SeverityHeatmap({
  data,
}: {
  data: { date: string; count: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <HeatMap data={data} dataKey="count">
        <XAxis dataKey="date" />
        <YAxis type="category" dataKey="date" hide />
        <Tooltip />
      </HeatMap>
    </ResponsiveContainer>
  );
}

function SystemGauges({ metrics }: { metrics: Metrics }) {
  return (
    <Grid className="gap-4 grid-cols-1 sm:grid-cols-3">
      <Card className="p-4">
        <ResponsiveContainer width="100%" height={150}>
          <RadialGauge dataKey="cpuUsage" value={metrics.cpuUsage} />
        </ResponsiveContainer>
      </Card>
      <Card className="p-4">
        <ResponsiveContainer width="100%" height={150}>
          <RadialGauge dataKey="memUsage" value={metrics.memUsage} />
        </ResponsiveContainer>
      </Card>
      <Card className="p-4">
        <ResponsiveContainer width="100%" height={150}>
          <RadialGauge dataKey="reqRate" value={metrics.reqRate} />
        </ResponsiveContainer>
      </Card>
    </Grid>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();

  const {
    data: alerts = [],
    isLoading: alertsLoading,
    error: alertsError,
  } = useQuery<Alert[]>(['/api/alerts'], () => fetch('/api/alerts').then((res) => res.json()));

  const metricsQuery = useQuery<Metrics>(
    ['/api/metrics'],
    () => fetch('/api/metrics').then((res) => res.json()),
    { staleTime: 30_000, refetchOnWindowFocus: false }
  );

  useWebSocket<Alert>(
    '/ws/alerts',
    ['alertCreated', 'alertUpdated'],
    (data) => {
      queryClient.invalidateQueries(['/api/alerts']);
      if (data.severity === 'high') {
        metricsQuery.refetch();
      }
    }
  );

  const heatData = useMemo(() => {
    const highAlerts = alerts.filter((a) => a.severity === 'high');
    const counts: Record<string, number> = {};
    highAlerts.forEach((a) => {
      const d = format(new Date(a.timestamp), 'yyyy-MM-dd');
      counts[d] = (counts[d] || 0) + 1;
    });
    return eachDayOfInterval({ start: subDays(new Date(), 6), end: new Date() }).map((d) => {
      const key = format(d, 'yyyy-MM-dd');
      return { date: key, count: counts[key] || 0 };
    });
  }, [alerts]);

  return (
    <div className="space-y-6 p-4">
      <IncidentCardsGrid alerts={alerts} loading={alertsLoading} error={alertsError} />
      {metricsQuery.data && <SystemGauges metrics={metricsQuery.data} />}
      <Card className="p-4">
        <SeverityHeatmap data={heatData} />
      </Card>
    </div>
  );
}
