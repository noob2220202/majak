import { io, type Socket } from 'socket.io-client';
import { create } from 'zustand';

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

interface ServerHello {
  protocolVersion: number;
}

interface ConnectionState {
  status: ConnectionStatus;
  serverProtocolVersion: number | null;
}

export const useConnectionStore = create<ConnectionState>(() => ({
  status: 'connecting',
  serverProtocolVersion: null,
}));

/**
 * 서버와 Socket.IO 연결을 맺고 상태를 스토어에 반영한다.
 * 반환된 함수로 연결을 해제한다 (React effect cleanup용).
 */
export function connectToServer(): () => void {
  useConnectionStore.setState({ status: 'connecting' });
  const socket: Socket = io({ transports: ['websocket'] });

  socket.on('connect', () => {
    useConnectionStore.setState({ status: 'connected' });
  });
  socket.on('server.hello', (hello: ServerHello) => {
    useConnectionStore.setState({ serverProtocolVersion: hello.protocolVersion });
  });
  socket.on('disconnect', () => {
    useConnectionStore.setState({ status: 'disconnected' });
  });
  socket.io.on('reconnect_attempt', () => {
    useConnectionStore.setState({ status: 'connecting' });
  });
  socket.on('connect_error', () => {
    useConnectionStore.setState({ status: 'disconnected' });
  });

  return () => {
    socket.disconnect();
  };
}
