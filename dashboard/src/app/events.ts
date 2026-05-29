export function subscribeToEvents(onEvent: () => void, onError?: () => void): () => void {
  let closed = false;
  let source: EventSource | null = null;
  let socket: WebSocket | null = null;
  let retry: number | undefined;
  let fallbackTimer: number | undefined;

  const connectSse = () => {
    source = new EventSource("/api/events/stream");
    source.onmessage = onEvent;
    source.onerror = () => {
      source?.close();
      source = null;
      onError?.();
      if (!closed) {
        retry = window.setTimeout(connect, 2500);
      }
    };
  };

  const connect = () => {
    if ("WebSocket" in window) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${protocol}//${window.location.host}/api/events/ws`);
      socket.onmessage = onEvent;
      socket.onerror = () => {
        onError?.();
        socket?.close();
      };
      socket.onclose = () => {
        socket = null;
        if (!closed && !source) {
          retry = window.setTimeout(connect, 2500);
        }
      };
      fallbackTimer = window.setTimeout(() => {
        if (!closed && socket?.readyState === WebSocket.CONNECTING) {
          socket.close();
          connectSse();
        }
      }, 2500);
      socket.onopen = () => {
        if (fallbackTimer) {
          window.clearTimeout(fallbackTimer);
          fallbackTimer = undefined;
        }
      };
      return;
    }
    connectSse();
  };

  connect();

  return () => {
    closed = true;
    socket?.close();
    source?.close();
    if (retry) {
      window.clearTimeout(retry);
    }
    if (fallbackTimer) {
      window.clearTimeout(fallbackTimer);
    }
  };
}
