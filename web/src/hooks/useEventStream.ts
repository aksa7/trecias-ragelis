import { useEffect, useRef, useState } from 'react';
import { isCallEvent, type CallEvent } from '../types';

export type StreamStatus = 'connecting' | 'online' | 'offline';

/**
 * Subscribe to the backend Server-Sent Events stream.
 * Each SSE message is expected as: `data: {"type":"transcript",...}\n\n`.
 * EventSource reconnects on its own; we only track the status.
 */
export function useEventStream(url: string, enabled: boolean, onEvent: (event: CallEvent) => void): StreamStatus {
  const [status, setStatus] = useState<StreamStatus>('connecting');
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!enabled) {
      setStatus('offline');
      return;
    }

    const source = new EventSource(url);
    setStatus('connecting');

    source.onopen = () => setStatus('online');
    source.onerror = () => setStatus(source.readyState === EventSource.CLOSED ? 'offline' : 'connecting');
    source.onmessage = (message: MessageEvent<string>) => {
      try {
        const parsed: unknown = JSON.parse(message.data);
        if (isCallEvent(parsed)) handler.current(parsed);
        else console.warn('[events] ignored unknown payload', parsed);
      } catch {
        console.warn('[events] invalid JSON', message.data);
      }
    };

    return () => source.close();
  }, [url, enabled]);

  return status;
}
