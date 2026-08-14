import io
import logging
from typing import Optional

logger = logging.getLogger(__name__)

class TTSService:
    def __init__(self):
        self.pocket_tts = None
        self.model = None
        self.voice_state = None
        self.is_ready = False
        try:
            import pocket_tts
            self.pocket_tts = pocket_tts
            logger.info("Pocket TTS module imported successfully.")
        except ImportError:
            logger.warning("Pocket TTS not installed yet.")

    def _init_model(self):
        """Lazy load the TTS model and voice state on first request to avoid blocking startup."""
        if not self.pocket_tts or self.is_ready:
            return
        
        try:
            logger.info("Loading Pocket TTS model and voice state (may take a moment to download)...")
            self.model = self.pocket_tts.TTSModel.load_model()
            # Use a built-in catalog voice (no HuggingFace auth required)
            # Available voices: cosette, marius, javert, alba, jean, anna, vera,
            #   fantine, charles, paul, eponine, azelma, george, mary, jane, michael, eve, etc.
            self.voice_state = self.model.get_state_for_audio_prompt("alba")
            self.is_ready = True
            logger.info("Pocket TTS is fully initialized and ready.")
        except Exception as e:
            logger.error(f"Failed to initialize Pocket TTS model: {e}")
            self.pocket_tts = None  # Disable TTS on failure

    def synthesize(self, text: str) -> bytes:
        self._init_model()
        
        if not self.is_ready:
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
            logger.info(f"Synthesizing speech for text: {text}")
            audio = self.model.generate_audio(self.voice_state, text, frames_after_eos=2, copy_state=True)
            
            import soundfile as sf
            import io
            
            buffer = io.BytesIO()
            audio_np = audio.cpu().numpy()
            # Soundfile expects (samples, channels)
            if audio_np.ndim == 2:
                audio_np = audio_np.T 
                
            sf.write(buffer, audio_np, self.model.sample_rate, format='WAV')
            return buffer.getvalue()
        except Exception as e:
            logger.error(f"Failed to synthesize audio: {e}")
            raise
