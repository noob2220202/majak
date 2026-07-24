import { useEffect } from 'react';
import { connectToServer } from './store/connection';
import { Lobby } from './lobby/Lobby';

export default function App() {
  useEffect(() => connectToServer(), []);
  return <Lobby />;
}
