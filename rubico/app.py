from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Body
from fastapi.responses import JSONResponse, StreamingResponse
import uuid
import os

from pydantic import BaseModel
from typing import List, Optional

from model.ArtworkMetadata import ArtworkMetadata
from utils.s3Server import (
    get_presigned_url_by_session_id,
    get_presigned_url_by_object_key,
    upload_bytes_and_get_presigned_url,
)
from ai_client.client_factory import AIClientFactory
from ai_client.tts_client import synthesize_speech_stream, synthesize_speech

app = FastAPI()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class Message(BaseModel):
    role: str
    content: str

class FollowupRequest(BaseModel):
    user_input: str
    artwork_name: str
    artwork_artist: str
    artwork_museum: str
    message_history: List[Message] = []

class TTSRequest(BaseModel):
    text: str
    voice: str = "alloy"

class TTSCacheRequest(BaseModel):
    text: str
    voice: str = "alloy"
    cache_key: Optional[str] = None

def _fnv1a_32(value: str) -> str:
    hash_value = 0x811c9dc5
    for byte in value.encode("utf-8"):
        hash_value ^= byte
        hash_value = (hash_value * 0x01000193) & 0xffffffff
    return f"{hash_value:08x}"

def _tts_cache_key(text: str, voice: str) -> str:
    return _fnv1a_32(f"{voice}:{text}")

def _tts_object_key(cache_key: str) -> str:
    return f"tts_cache/{cache_key}.mp3"

@app.post("/api/recognize")
async def upload_image(
    image: UploadFile = File(...),
    language: str = Form(default="en"),
    role: str = Form(default="adult"),
):
    image_bytes = await image.read()
    session_id = str(uuid.uuid4())
    
    # Create client using factory
    client = AIClientFactory.create_client("gpt", language=language, role=role)

    # 1. Generate initial structured data (parsed JSON)
    parsed_artworks_info: ArtworkMetadata = client.generate_initial_description(
        image_bytes=image_bytes
    )

    # Return immediate response with text only
    return JSONResponse({
        "session_id": session_id,
        "title": parsed_artworks_info.title,
        "artist": parsed_artworks_info.artist,
        "museum_name": parsed_artworks_info.museum_name,
        "description": parsed_artworks_info.description,
        "audio_description_url": None  # Stream on demand via /api/tts_stream
    })

@app.get("/api/audio_url")
async def get_audio_url(session_id: str):
    """
    Get the presigned URL for the audio file associated with the session_id.
    Returns None if the audio is not ready yet.
    """
    print("Called get_audio_url" + session_id)
    audio_url = get_presigned_url_by_session_id(session_id)
    return JSONResponse({"audio_url": audio_url})

@app.post("/api/followup")
async def ask_question(payload: FollowupRequest = Body(...)):
    try:
        # Debug print
        print(f"Received user_input: {payload.user_input}")
        print(f"History: {payload.message_history}")

        # Create context string
        context_parts = []
        if payload.artwork_name:
            context_parts.append(f"Artwork: {payload.artwork_name}")
        if payload.artwork_artist:
            context_parts.append(f"by {payload.artwork_artist}")
        if payload.artwork_museum:
            context_parts.append(f"at {payload.artwork_museum}")
        context = " ".join(context_parts) + ". "

        # Compose final input
        user_input_with_context = context + payload.user_input

        # Create client using factory
        client = AIClientFactory.create_client("gpt")
        
        # Generate reply using the client instance
        reply = client.continue_conversation(user_input_with_context, payload.message_history)

        return JSONResponse({"reply": reply})
    except Exception as e:
        print("Error:", e)
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/tts_stream")
async def tts_stream(payload: TTSRequest):
    """
    Stream TTS audio chunks back to the caller as soon as they're produced.
    """
    if not payload.text:
        raise HTTPException(status_code=400, detail="Text is required")

    audio_iterable = synthesize_speech_stream(
        text=payload.text,
        voice=payload.voice,
    )
    return StreamingResponse(audio_iterable, media_type="audio/mpeg")

@app.get("/api/tts_stream")
async def tts_stream_get(text: str, voice: str = "alloy"):
    """
    Stream TTS audio via GET for clients that can only play URL sources.
    """
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")

    audio_iterable = synthesize_speech_stream(
        text=text,
        voice=voice,
    )
    return StreamingResponse(audio_iterable, media_type="audio/mpeg")

@app.get("/api/tts_cache")
async def tts_cache_lookup(cache_key: str):
    """
    Return a presigned URL for a cached TTS audio file if it exists in S3.
    """
    object_key = _tts_object_key(cache_key)
    audio_url = get_presigned_url_by_object_key(object_key)
    return JSONResponse({"audio_url": audio_url, "cache_key": cache_key})

@app.post("/api/tts_cache")
async def tts_cache(payload: TTSCacheRequest = Body(...)):
    """
    Generate and cache TTS audio in S3 (or return existing cached URL).
    """
    if not payload.text:
        raise HTTPException(status_code=400, detail="Text is required")

    cache_key = payload.cache_key or _tts_cache_key(payload.text, payload.voice)
    object_key = _tts_object_key(cache_key)

    audio_url = get_presigned_url_by_object_key(object_key)
    if audio_url:
        return JSONResponse({"audio_url": audio_url, "cache_key": cache_key})

    audio_bytes = synthesize_speech(payload.text, voice=payload.voice)
    audio_url = upload_bytes_and_get_presigned_url(audio_bytes, object_key)
    return JSONResponse({"audio_url": audio_url, "cache_key": cache_key})
