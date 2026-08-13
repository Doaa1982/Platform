from faster_whisper import WhisperModel


class TranscriptionEngine:
    def __init__(
        self,
        model_size: str = "small",
        device: str = "cpu",
        compute_type: str = "int8",
    ):
        self.model = WhisperModel(
            model_size,
            device=device,
            compute_type=compute_type,
        )

    def transcribe(self, file_path: str):
        segments, info = self.model.transcribe(
            file_path,
           language="ar", beam_size=5,
        )

        result = []

        for segment in segments:
            result.append(
                {
                    "start": segment.start,
                    "end": segment.end,
                    "text": segment.text.strip(),
                }
            )

        return {
            "language": info.language,
            "language_probability": info.language_probability,
            "segments": result,
        }