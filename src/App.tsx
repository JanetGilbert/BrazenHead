import { useState, useCallback, useRef, useEffect } from 'react';
import ThreeScene from './ThreeScene';
import type { ThreeSceneHandle } from './ThreeScene';
import { speakText, playTestData, SAVE_TEST_DATA } from './ttsService';
import './App.css';

const TEST_TEXT = "Hello.";

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
          console.log("viseme:" +viseme);
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

  // ── Cheat key: press F9 to replay test_data/Test.pcm + Test.json ──
  useEffect(() => {
    if (!SAVE_TEST_DATA) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'F9' || status === 'speaking') return;
      e.preventDefault();
      setStatus('speaking');
      setErrorMsg('');

      playTestData(
        (viseme) => {
          console.log('viseme:', viseme);
          sceneHandleRef.current?.setPhoneme(viseme);
        },
        (msg) => {
          setStatus('error');
          setErrorMsg(msg);
        },
      )
        .then(() => setStatus('idle'))
        .catch((err) => {
          setStatus('error');
          setErrorMsg(err instanceof Error ? err.message : 'Playback failed');
        });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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
