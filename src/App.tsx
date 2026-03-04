import { useState, useCallback, useRef } from 'react';
import ThreeScene from './ThreeScene';
import type { ThreeSceneHandle } from './ThreeScene';
import {
  connectInworld,
  startMicrophone,
  stopMicrophone,
  disconnect,
} from './inworldService';
import type { InworldConnectionService } from '@inworld/web-core';
import './App.css';

function App() {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'ready' | 'error'>('idle');
  const [listening, setListening] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const connectionRef = useRef<InworldConnectionService | null>(null);
  const sceneHandleRef = useRef<ThreeSceneHandle | null>(null);

  /** Called by ThreeScene once the model is loaded. */
  const handleSceneReady = useCallback((handle: ThreeSceneHandle) => {
    sceneHandleRef.current = handle;
  }, []);

  /** Connect to Inworld when the user clicks "Connect". */
  const handleConnect = useCallback(async () => {
    if (status === 'ready' || status === 'connecting') return;
    setStatus('connecting');
    setErrorMsg('');

    try {
      const conn = await connectInworld({
        onPhoneme: (phoneme) => {
          sceneHandleRef.current?.setPhoneme(phoneme);
        },
        onText: (text, isFinal) => {
          if (isFinal) setResponseText(text);
        },
        onReady: () => setStatus('ready'),
        onError: (msg) => {
          setStatus('error');
          setErrorMsg(msg);
        },
      });
      connectionRef.current = conn;
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Connection failed');
    }
  }, [status]);

  /** Disconnect from Inworld. */
  const handleDisconnect = useCallback(async () => {
    await disconnect();
    connectionRef.current = null;
    setStatus('idle');
    setListening(false);
    setResponseText('');
  }, []);

  /** Toggle microphone on/off. */
  const handleMicToggle = useCallback(async () => {
    if (!connectionRef.current) return;
    try {
      if (listening) {
        await stopMicrophone();
        setListening(false);
      } else {
        await startMicrophone();
        setListening(true);
      }
    } catch (err) {
      console.error('Mic toggle error:', err);
    }
  }, [listening]);

  return (
    <div className="App">
      <ThreeScene onReady={handleSceneReady} />

      {/* ── HUD overlay ── */}
      <div className="hud">
        {status === 'idle' && (
          <button className="hud-btn connect-btn" onClick={handleConnect}>
            Connect
          </button>
        )}

        {status === 'connecting' && (
          <span className="hud-status">Connecting…</span>
        )}

        {status === 'ready' && (
          <>
            <button
              className={`hud-btn mic-btn ${listening ? 'active' : ''}`}
              onClick={handleMicToggle}
            >
              {listening ? '🔴 Stop' : '🎤 Speak'}
            </button>
            <button className="hud-btn disconnect-btn" onClick={handleDisconnect}>
              Disconnect
            </button>
          </>
        )}

        {status === 'error' && (
          <div className="hud-error">
            <span>Error: {errorMsg}</span>
            <button className="hud-btn connect-btn" onClick={handleConnect}>
              Retry
            </button>
          </div>
        )}

        {responseText && (
          <div className="hud-response">{responseText}</div>
        )}
      </div>
    </div>
  );
}

export default App;
