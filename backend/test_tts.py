import io
import soundfile as sf
import torch
from pocket_tts import TTSModel

def test_tts():
    print("Loading model...")
    model = TTSModel.load_model()
    print("Loading voice state...")
    voice_state = model.get_state_for_audio_prompt("hf://kyutai/tts-voices/alba-mackenna/casual.wav")
    print("Generating audio...")
    audio = model.generate_audio(voice_state, "Hello world!", frames_after_eos=2, copy_state=True)
    
    print(f"Audio type: {type(audio)}, shape: {audio.shape}")
    
    # Convert to bytes
    buffer = io.BytesIO()
    audio_np = audio.cpu().numpy()
    if audio_np.ndim == 2:
        audio_np = audio_np.T # shape to (samples, channels)
    sf.write(buffer, audio_np, model.sample_rate, format='WAV')
    bytes_data = buffer.getvalue()
    print(f"Generated {len(bytes_data)} bytes of WAV data.")

if __name__ == "__main__":
    test_tts()
