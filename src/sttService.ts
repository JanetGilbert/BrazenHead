/**
 * Speech-to-text service.
 *
 * Records audio from the user's microphone via MediaRecorder,
 * then sends the recording to the HuggingFace Whisper STT API
 * via our backend proxy.
 */

const STT_ENDPOINT = '/api/stt';

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];

/**
 * Start recording audio from the microphone.
 * Requests mic permission if not already granted.
 */
export async function startRecording(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioChunks = [];

  mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) audioChunks.push(e.data);
  };
  mediaRecorder.start();
}

/**
 * Stop recording and send the audio to the STT proxy.
 * Returns the transcribed text (trimmed).
 */
export async function stopRecordingAndTranscribe(): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      reject(new Error('No active recording'));
      return;
    }

    mediaRecorder.onstop = async () => {
      // Stop all mic tracks
      mediaRecorder!.stream.getTracks().forEach((t) => t.stop());

      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      audioChunks = [];

      try {
        const res = await fetch(STT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'audio/webm' },
          body: audioBlob,
        });

        if (!res.ok) {
          const detail = await res.text().catch(() => '');
          throw new Error(`STT request failed (${res.status}): ${detail}`);
        }

        const data = await res.json();
        resolve((data.text ?? '').trim());
      } catch (err) {
        reject(err);
      }
    };

    mediaRecorder.stop();
  });
}
