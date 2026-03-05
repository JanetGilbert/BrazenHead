import { useState, useCallback, useRef } from 'react';
import ThreeScene from './ThreeScene';
import type { ThreeSceneHandle } from './ThreeScene';
import { speakText } from './ttsService';
import './App.css';

const TEST_TEXT = "Hello, adventurer! What a beautiful day, isn't it?";

function App() {
  const [status, setStatus] = useState<'idle' | 'speaking' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const sceneHandleRef = useRef<ThreeSceneHandle | null>(null);

  /** Called by ThreeScene once the model is loaded. */
  const handleSceneReady = useCallback((handle: ThreeSceneHandle) => {
    sceneHandleRef.current = handle;
  }, []);

  /** Send test text to TTS and play with lip-sync. */
  const handleSpeak = useCallback(async () => {
    if (status === 'speaking') return;
    setStatus('speaking');
    setErrorMsg('');

    try {
      await speakText(
        TEST_TEXT,
        (viseme) => {
          sceneHandleRef.current?.setPhoneme(viseme);
        },
        (msg) => {
          setStatus('error');
          setErrorMsg(msg);
        },
      );
      setStatus('idle');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'TTS failed');
    }
  }, [status]);

  return (
    <div className="App">
      <ThreeScene onReady={handleSceneReady} />

      {/* ── HUD overlay ── */}
      <div className="hud">
        {status === 'idle' && (
          <button className="hud-btn connect-btn" onClick={handleSpeak}>
            Speak
          </button>
        )}

        {status === 'speaking' && (
          <span className="hud-status">Speaking…</span>
        )}

        {status === 'error' && (
          <div className="hud-error">
            <span>Error: {errorMsg}</span>
            <button className="hud-btn connect-btn" onClick={handleSpeak}>
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
