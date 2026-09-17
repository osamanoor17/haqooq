import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

client = Groq()

def test_language(user_query):
    system_prompt = """You are 'Haqooq', an expert legal advisor AI for Pakistani Law.

CRITICAL LANGUAGE RULES:
1. MATCH THE USER'S LANGUAGE EXACTLY:
   - If the user's message is in ENGLISH -> You MUST write your entire response in ENGLISH.
   - If the user's message is in ROMAN URDU -> You MUST write your entire response in ROMAN URDU.
   - If the user's message is in URDU SCRIPT (اردو) -> You MUST write your entire response in URDU SCRIPT (اردو).
2. DO NOT respond in Roman Urdu if the question is in English.
3. Keep responses structured, concise, and professional with procedures, required documents, and legal references."""

    completion = client.chat.completions.create(
        model="qwen/qwen3.8-27b",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_query}
        ],
        temperature=0.1,
        max_tokens=400
    )
    return completion.choices[0].message.content

print("--- Testing English Query ---")
print(test_language("my bike has stolen whats the procedure to make a fir?"))

print("\n--- Testing Roman Urdu Query ---")
print(test_language("meri bike chori ho gayi hai fir kese katwaon?"))
