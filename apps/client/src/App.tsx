import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { initNetworking } from './store/game';
import { useGame } from './store/game';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Lobby } from './screens/Lobby';
import { Room } from './screens/Room';
import { GameScreen } from './screens/game/GameScreen';

function ErrorToast() {
  const error = useGame((s) => s.error);
  const dismiss = useGame((s) => s.dismissError);
  useEffect(() => {
    if (!error) return;
    const id = setTimeout(dismiss, 4000);
    return () => clearTimeout(id);
  }, [error, dismiss]);

  return (
    <AnimatePresence>
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg bg-dan-red px-4 py-2 text-sm text-hanji shadow-xl"
          onClick={dismiss}
          role="alert"
        >
          {error.message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  const screen = useGame((s) => s.screen);
  useEffect(() => {
    initNetworking();
  }, []);

  return (
    <>
      <ErrorBoundary>
        {screen === 'game' ? <GameScreen /> : screen === 'room' ? <Room /> : <Lobby />}
      </ErrorBoundary>
      <ErrorToast />
    </>
  );
}
