from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import io

from services.tts_service import TTSService

router = APIRouter(prefix="/api/tts", tags=["TTS"])

# Instantiate the service
tts_service = TTSService()

class TTSRequest(BaseModel):
    text: str
    voice: str = "default"

@router.post("")
def generate_audio(req: TTSRequest):
    try:
        audio_bytes = tts_service.synthesize(req.text)
        return StreamingResponse(io.BytesIO(audio_bytes), media_type="audio/wav")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
