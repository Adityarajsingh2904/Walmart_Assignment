import { useEffect, useRef } from 'react';
import { useQueryClient } from 'react-query';
import throttle from 'lodash/throttle';
import useWebSocket from '@/ui-dashboard/hooks/useWebSocket';

export default function LiveUpdates(): null {
  const queryClient = useQueryClient();
  const handlerRef = useRef<(event: string, payload: any) => void>();

  useEffect(() => {
    const throttled = throttle((event: string, payload: any) => {
      queryClient.invalidateQueries('alerts');
      if (event === 'alertCreated' && payload?.severity === 'high') {
        queryClient.invalidateQueries('metrics');
      }
    }, 1000);

    handlerRef.current = throttled;
    return () => {
      throttled.cancel();
    };
  }, [queryClient]);

  useWebSocket('/ws/alerts', ['alertCreated', 'alertUpdated'], (event, payload) => {
    handlerRef.current?.(event, payload);
  });

  return null;
}
