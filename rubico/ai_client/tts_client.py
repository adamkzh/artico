from openai import OpenAI
from typing import Iterable

client = OpenAI()

def synthesize_speech_stream(
    text: str,
    voice: str = "alloy",
    model: str = "gpt-4o-mini-tts",
) -> Iterable[bytes]:
    """
    Stream audio bytes from OpenAI TTS so playback can start sooner.
    """
    with client.audio.speech.with_streaming_response.create(
        model=model,
        voice=voice,
        input=text,
    ) as response:
        for chunk in response.iter_bytes():
            yield chunk

def synthesize_speech(
    text: str,
    voice: str = "alloy",
    model: str = "gpt-4o-mini-tts",
) -> bytes:
    """
    Backwards-compatible helper that materializes the streamed audio.
    """
    return b"".join(synthesize_speech_stream(text, voice=voice, model=model))
