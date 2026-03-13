import { useState, useCallback, useRef, useEffect } from 'react';
import ThreeScene from './ThreeScene';
import type { ThreeSceneHandle } from './ThreeScene';
import { speakText, playTestData, SAVE_TEST_DATA } from './ttsService';
import { startRecording, stopRecordingAndTranscribe } from './sttService';
import { sendChat, SYSTEM_PROMPT } from './chatService';
import type { ChatMessage } from './chatService';
import './App.css';

function App() {
  const [status, setStatus] = useState<'idle' | 'recording' | 'processing' | 'speaking' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const sceneHandleRef = useRef<ThreeSceneHandle | null>(null);
  const conversationRef = useRef<ChatMessage[]>([SYSTEM_PROMPT]);

  /** Called by ThreeScene once the model is loaded. */
  const handleSceneReady = useCallback((handle: ThreeSceneHandle) => {
    sceneHandleRef.current = handle;
  }, []);

  const visemeHandler = useCallback((viseme: string) => {
    console.log('viseme:', viseme);
    sceneHandleRef.current?.setPhoneme(viseme);
  }, []);

  const errorHandler = useCallback((msg: string) => {
    setStatus('error');
    setErrorMsg(msg);
  }, []);

  /** Start mic recording. */
  const handleSpeak = useCallback(async () => {
    if (status !== 'idle') return;
    setErrorMsg('');
    try {
      await startRecording();
      sceneHandleRef.current?.setEyesClosed(true);
      setStatus('recording');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Mic access failed');
    }
  }, [status]);

  /** Stop recording → transcribe → chat LLM → speak reply via TTS. */
  const handleDone = useCallback(async () => {
    if (status !== 'recording') return;
    setStatus('processing');

    try {
      const transcript = await stopRecordingAndTranscribe();
      if (!transcript) {
        sceneHandleRef.current?.setEyesClosed(false);
        setStatus('idle');
        return;
      }
      console.log('[STT] transcript:', transcript);

      // Build conversation with user message
      conversationRef.current = [...conversationRef.current, { role: 'user', content: transcript }];

      const reply = await sendChat(conversationRef.current);
      console.log('[Chat] reply:', reply);

      // Append assistant reply to history
      conversationRef.current = [...conversationRef.current, { role: 'assistant', content: reply }];

      setStatus('speaking');
      sceneHandleRef.current?.setEyesClosed(false);
      await speakText(reply, visemeHandler, errorHandler);
      setStatus('idle');
    } catch (err) {
      sceneHandleRef.current?.setEyesClosed(false);
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'STT/Chat/TTS failed');
    }
  }, [status, visemeHandler, errorHandler]);

  // ── Cheat key: press F9 to replay test_data/Test.pcm + Test.json ──
  useEffect(() => {
    if (!SAVE_TEST_DATA) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'F9' || status === 'speaking') return;
      e.preventDefault();
      setStatus('speaking');
      setErrorMsg('');

      playTestData(visemeHandler, errorHandler)
        .then(() => setStatus('idle'))
        .catch((err) => {
          setStatus('error');
          setErrorMsg(err instanceof Error ? err.message : 'Playback failed');
        });
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [status, visemeHandler, errorHandler]);

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

        {status === 'recording' && (
          <button className="hud-btn mic-btn active" onClick={handleDone}>
            Done
          </button>
        )}

        {status === 'processing' && (
          <span className="hud-status">Processing…</span>
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
