import { io, Socket } from 'socket.io-client';
import { useEffect, useRef, useState } from 'react';

// This hook manages a Socket.IO connection with automatic reconnection.
// The reconnect delay is doubled on each disconnect up to 30 seconds
// and reset back to 1 second after a successful connection.

type WebSocketHook = {
  connected: boolean;
  error?: Error;
};

export default function useWebSocket(
  url: string,
  eventNames: string[],
  onMessage: (event: string, payload: any) => void
): WebSocketHook {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const reconnectDelay = useRef(1000); // start at 1s

  useEffect(() => {
    let isMounted = true;

    const subscribe = (socket: Socket) => {
      eventNames.forEach((event) => {
        socket.on(event, (payload: any) => onMessage(event, payload));
      });
    };

    const cleanup = () => {
      socketRef.current?.removeAllListeners();
      socketRef.current?.disconnect();
      socketRef.current = null;
    };

    const connect = () => {
      cleanup();
      const socket = io(url, { autoConnect: false });
      socketRef.current = socket;

      socket.on('connect', () => {
        if (!isMounted) return;
        setConnected(true);
        setError(undefined);
        reconnectDelay.current = 1000; // reset backoff on success
      });

      socket.on('connect_error', (err: Error) => {
        if (!isMounted) return;
        // Just store the error rather than emitting it through onMessage
        setError(err);
      });

      socket.on('disconnect', () => {
        if (!isMounted) return;
        setConnected(false);
        // exponential backoff: double delay each time up to 30s
        const delay = reconnectDelay.current;
        reconnectDelay.current = Math.min(delay * 2, 30000);
        setTimeout(() => {
          if (isMounted) connect();
        }, delay);
      });

      subscribe(socket);
      socket.connect();
    };

    connect();

    return () => {
      isMounted = false;
      cleanup();
    };
    // eventNames array may change; join for stable dependency
  }, [url, eventNames.join(','), onMessage]);

  return { connected, error };
}
