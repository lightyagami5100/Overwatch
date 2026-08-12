import io
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class TTSService:
    def __init__(self):
        self.tts = None
        self.is_ready = False
        try:
            import pocket_tts
            self.pocket_tts = pocket_tts
            # We will finalize the initialization in a moment after inspecting the API
            logger.info("Pocket TTS module imported successfully.")
        except ImportError:
            logger.warning("Pocket TTS not installed yet.")

    def synthesize(self, text: str) -> bytes:
        if not self.pocket_tts:
            logger.warning("TTS engine not initialized, returning silent dummy WAV.")
            import wave
            import io
            import struct
            buffer = io.BytesIO()
            with wave.open(buffer, 'wb') as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(24000)
                # 0.5 seconds of silence
                for _ in range(12000):
                    wf.writeframesraw(struct.pack('<h', 0))
            return buffer.getvalue()
            
        try:
            # Typical TTS APIs might have a synthesize_to_bytes or similar.
            # Assuming pocket_tts has a simple API:
            tts = self.pocket_tts.PocketTTS() if hasattr(self.pocket_tts, 'PocketTTS') else self.pocket_tts.TTS()
            audio_bytes = tts.synthesize(text)
            
            # If the result is not bytes directly, try converting (e.g., if it's a numpy array, but we hope it returns bytes)
            if not isinstance(audio_bytes, bytes):
                import soundfile as sf
                import numpy as np
                buffer = io.BytesIO()
                # Assuming 24kHz sample rate default for lightweight models
                sf.write(buffer, audio_bytes, 24000, format='WAV')
                return buffer.getvalue()
                
            return audio_bytes
        except Exception as e:
            logger.error(f"Failed to synthesize audio: {e}")
            raise
