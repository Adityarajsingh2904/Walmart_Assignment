import React from 'react';
import { Card } from 'shadcn/ui';
import { Badge } from 'shadcn/ui';
import { Tooltip } from 'shadcn/ui';
import { Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export interface Incident {
  id: string;
  title: string;
  severity: 'low' | 'medium' | 'high';
  timestamp: string; // ISO8601 UTC
}

function severityClasses(severity: Incident['severity']): string {
  switch (severity) {
    case 'low':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    case 'medium':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'high':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200';
    default:
      return '';
  }
}

export default function IncidentCard({
  incident,
  onClick,
}: {
  incident: Incident;
  onClick?: () => void;
}): JSX.Element {
  const title = incident.title || 'Untitled incident';
  let timeText = '—';
  const date = new Date(incident.timestamp);
  if (!isNaN(date.getTime())) {
    timeText = formatDistanceToNow(date, { addSuffix: true });
  }
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      aria-label={`View incident ${incident.title}`}
      className="p-4 space-y-2 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
    >
      <div className="flex justify-between items-start">
        <Tooltip side="top" content={title}>
          <h3 className="font-semibold text-sm truncate max-w-[40ch]">{title}</h3>
        </Tooltip>
        <Badge className={severityClasses(incident.severity)}>
          {incident.severity}
        </Badge>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        <Clock size={16} className="inline-block mr-1" />
        {timeText}
      </p>
    </Card>
  );
}
