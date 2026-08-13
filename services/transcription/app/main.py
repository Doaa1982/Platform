import os
import uuid

from fastapi import FastAPI, UploadFile, File

from .transcription import TranscriptionEngine


app = FastAPI(
    title="Platform Local Transcription Service",
    version="1.0.0",
)


engine = TranscriptionEngine(
    model_size=os.getenv("WHISPER_MODEL", "medium"),
    device=os.getenv("WHISPER_DEVICE", "cpu"),
    compute_type=os.getenv("WHISPER_COMPUTE_TYPE", "int8"),
)


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "local-transcription",
    }


@app.post("/api/transcriptions")
async def transcribe(file: UploadFile = File(...)):
    os.makedirs("temp", exist_ok=True)

    extension = os.path.splitext(file.filename)[1]

    file_id = str(uuid.uuid4())

    file_path = os.path.join(
        "temp",
        f"{file_id}{extension}",
    )

    with open(file_path, "wb") as buffer:
        while chunk := await file.read(1024 * 1024):
            buffer.write(chunk)

    try:
        result = engine.transcribe(file_path)

        return {
            "id": file_id,
            "filename": file.filename,
            **result,
        }

    finally:
        if os.path.exists(file_path):
            os.remove(file_path)