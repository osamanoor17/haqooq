from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import asyncio
import edge_tts
from groq import Groq
from backend.legal_advisor import init_rag_chain, get_groq_client
import tempfile
import base64
import json
import re
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Haqooq AI Legal Advisor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For dev only
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

rag_chain = None

def get_rag():
    global rag_chain
    if rag_chain is None:
        rag_chain = init_rag_chain()
    return rag_chain

@app.on_event("startup")
async def startup_event():
    get_rag()

class ChatRequest(BaseModel):
    message: str
    history: list

@app.post("/chat/text")
def chat_text(request: ChatRequest):
    try:
        user_query = request.message
        history = request.history
        
        formatted_history = ""
        for msg in history:
            role = "User" if msg.get("role") == "user" else "AI"
            formatted_history += f"{role}: {msg.get('content', '')}\n"
            
        print(f"--> Processing text query: {user_query[:60]}...")
        chain = get_rag()
        response = chain.invoke({"question": user_query, "history": formatted_history})
        print(f"<-- Response generated successfully ({len(response)} chars)")
        return {"response": response, "audio": None}
    except Exception as e:
        print(f"Error in chat_text: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat/audio")
async def chat_audio(audio: UploadFile = File(...), history: str = Form(...)):
    try:
        history_list = json.loads(history)
        
        # Save temp file for whisper
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp_audio:
            temp_audio.write(await audio.read())
            temp_path = temp_audio.name
            
        client = get_groq_client()
        # Transcribe with auto-detection
        with open(temp_path, "rb") as f:
            file_bytes = f.read()
            transcription = client.audio.transcriptions.create(
                file=(os.path.basename(temp_path), file_bytes),
                model="whisper-large-v3",
            )
        
        user_query = transcription.text
        
        # If Whisper auto-detected Hindi and outputted Devanagari script, force it to Urdu
        if any('\u0900' <= c <= '\u097F' for c in user_query):
            transcription = client.audio.transcriptions.create(
                file=(os.path.basename(temp_path), file_bytes),
                model="whisper-large-v3",
                language="ur"
            )
            user_query = transcription.text
        os.remove(temp_path)
        
        formatted_history = ""
        for msg in history_list:
            role = "User" if msg.get("role") == "user" else "AI"
            formatted_history += f"{role}: {msg.get('content', '')}\n"
            
        # Generate Response
        # We append a hidden instruction to force Proper Urdu Script for Urdu queries, but allow English for English queries
        audio_instruction = "\n[System: If the user's voice query is in English, reply in English. If the user's voice query is in Urdu or Roman Urdu, you MUST reply in Proper Urdu Script (اردو) so the Urdu TTS engine pronounces it correctly. Do NOT use Roman Urdu in your response.]"
        response = get_rag().invoke({"question": user_query + audio_instruction, "history": formatted_history})
        
        # Clean response for TTS
        tts_text = response
        # Remove References section completely
        tts_text = re.split(r'(?i)References:|حوالہ جات:', tts_text)[0]
        # Remove any URLs
        tts_text = re.sub(r'http[s]?://\S+', '', tts_text)
        # Make headings sound natural and remove markdown chars
        tts_text = tts_text.replace("Required Documents:", "Zaroori kaghzaat hain:")
        tts_text = tts_text.replace("مطلوبہ دستاویزات:", "Zaroori kaghzaat hain:")
        tts_text = tts_text.replace("*", "").replace("#", "").replace("-", "")
        
        # Generate TTS Audio
        voice = "ur-PK-UzmaNeural" if any('\u0600' <= c <= '\u06FF' for c in tts_text) else "en-US-AriaNeural"
        
        tts_temp_path = tempfile.mktemp(suffix=".mp3")
        communicate = edge_tts.Communicate(tts_text.strip(), voice)
        await communicate.save(tts_temp_path)
        
        # Read and base64 encode the audio to send back
        with open(tts_temp_path, "rb") as audio_file:
            encoded_string = base64.b64encode(audio_file.read()).decode('utf-8')
            
        os.remove(tts_temp_path)
        
        return {
            "transcription": user_query,
            "response": response,
            "audio": encoded_string
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
