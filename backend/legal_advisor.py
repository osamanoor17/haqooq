import os
import re
from dotenv import load_dotenv
from groq import Groq
from pinecone import Pinecone
from langchain_pinecone import PineconeVectorStore

load_dotenv()

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "haqooq-legal-db")

class PineconeCloudEmbeddings:
    """
    100% Cloud-based embeddings using Pinecone Inference API.
    Zero local CPU/GPU/RAM load on your laptop.
    """
    def __init__(self, pinecone_api_key: str, model: str = "multilingual-e5-large"):
        self.pc = Pinecone(api_key=pinecone_api_key)
        self.model = model

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        all_embeddings = []
        batch_size = 96
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch = [t if t.strip() else " " for t in batch]
            res = self.pc.inference.embed(
                model=self.model,
                inputs=batch,
                parameters={"input_type": "passage"}
            )
            all_embeddings.extend([item["values"] for item in res])
        return all_embeddings

    def embed_query(self, text: str) -> list[float]:
        clean_text = text if text.strip() else " "
        res = self.pc.inference.embed(
            model=self.model,
            inputs=[clean_text],
            parameters={"input_type": "query"}
        )
        return res[0]["values"]

# Global variables for model instances
_vectorstore = None
_groq_client = None

def get_groq_client():
    global _groq_client
    if _groq_client is None:
        _groq_client = Groq()
    return _groq_client

def get_vectorstore():
    global _vectorstore
    if _vectorstore is None:
        if not PINECONE_API_KEY:
            raise ValueError("PINECONE_API_KEY is not configured in .env")
        
        print("Connecting to Pinecone Cloud Vector Store...")
        embeddings = PineconeCloudEmbeddings(pinecone_api_key=PINECONE_API_KEY)
        _vectorstore = PineconeVectorStore(
            index_name=PINECONE_INDEX_NAME,
            embedding=embeddings,
            pinecone_api_key=PINECONE_API_KEY
        )
    return _vectorstore

def translate_and_expand_query(question: str, history: str) -> str:
    """
    Translates/expands user query (especially Roman Urdu / Urdu queries) into
    precise English legal search terms to maximize retrieval accuracy.
    """
    clean_question = question.split("\n[System:")[0].strip()
    
    try:
        client = get_groq_client()
        expansion_prompt = f"""You are a search query optimizer for a Pakistani Legal Database.
Convert the user's situation/query (which may be in Roman Urdu, Urdu, or English) into concise English legal keywords and terminology applicable under Pakistani Law (such as Pakistan Penal Code, CrPC, PECA 2016, Family Laws, etc.).

Recent Conversation History:
{history[-500:] if history else 'None'}

User Situation: "{clean_question}"

Instructions:
- Output ONLY 4 to 10 relevant English legal search keywords.
- Do NOT output explanations or preamble.
- Example: "meri bike chori hogayi" -> "theft of motor vehicle stolen motorcycle Pakistan Penal Code section 378 379"
- Example: "biwi se talaq ka legal tareeqa" -> "divorce talaq procedure Union Council notice Muslim Family Laws Ordinance 1961"
"""
        completion = client.chat.completions.create(
            model="openai/gpt-oss-20b",
            messages=[{"role": "user", "content": expansion_prompt}],
            temperature=0.1,
            max_tokens=300
        )
        msg = completion.choices[0].message
        expanded_terms = (msg.content or "").strip()
        return f"{clean_question} {expanded_terms}"
    except Exception as e:
        print(f"Query expansion notice: {e}")
        return clean_question

class HaqooqRAGChain:
    def invoke(self, inputs: dict) -> str:
        question = inputs.get("question", "")
        history = inputs.get("history", "")
        clean_question = question.split("\n[System:")[0].strip()
        
        # 1. Expand query for higher recall
        expanded_query = translate_and_expand_query(clean_question, history)
        
        # 2. Retrieve relevant legal docs directly from Pinecone Cloud
        vs = get_vectorstore()
        docs = vs.similarity_search(expanded_query, k=5)
        
        if docs:
            formatted_docs = []
            for doc in docs:
                source = doc.metadata.get("source", "Unknown Source")
                formatted_docs.append(f"[Source: {source}]\n{doc.page_content}")
            context_text = "\n\n".join(formatted_docs)
        else:
            context_text = "No relevant legal provisions found in database."
            
        system_prompt = f"""You are 'Haqooq', an expert bilingual legal advisor AI for Pakistani Law.

CRITICAL LANGUAGE INSTRUCTIONS:
1. STRICT LANGUAGE MATCHING:
   - Carefully detect the language of the user's question and reply in the EXACT SAME LANGUAGE:
     * If user asks in ENGLISH -> Write your entire response in ENGLISH. Do NOT use Roman Urdu or Urdu words.
     * If user asks in ROMAN URDU -> Write your entire response in ROMAN URDU (using natural Pakistani Urdu words like 'shakhs', 'mutabiq', 'khas', 'rabta').
     * If user asks in URDU SCRIPT (اردو) -> Write your entire response in URDU SCRIPT (اردو).
   - NEVER default to Roman Urdu when the user asks a question in English.
2. DIRECT & CONCISE: No pleasantries or greetings. Start directly with legal procedure.
3. CONTEXTUAL ACCURACY: Base your advice strictly on relevant Pakistani Law and the provided context.
4. REQUIRED DOCUMENTS: If applicable, list required documents under 'Required Documents:' (or 'Zaroori Kaghzaat:').
5. REFERENCES: Include legal references under 'References:' (e.g., [Pakistan Penal Code, Section 379](https://www.google.com/search?q=Pakistan+Penal+Code+Section+379)).

Previous Chat History:
{history}

Context (Relevant Laws with Sources from Database):
{context_text}"""

        user_content = f"{question}\n\n[REMINDER: Detect user query language. If English, reply in English. If Roman Urdu, reply in Roman Urdu. If Urdu script, reply in Urdu script.]"
        
        client = get_groq_client()
        completion = client.chat.completions.create(
            model="qwen/qwen3.8-27b",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content}
            ],
            temperature=0.2,
            max_tokens=800
        )
        msg = completion.choices[0].message
        output_text = msg.content or ""
        output_text = re.sub(r'<think>.*?</think>', '', output_text, flags=re.DOTALL).strip()
        return output_text

_rag_chain_instance = HaqooqRAGChain()

def init_rag_chain():
    get_vectorstore()
    return _rag_chain_instance

def get_legal_advice(message, history):
    if not message.strip():
        yield "Please provide a query."
        return
    formatted_history = ""
    for msg in history:
        if isinstance(msg, dict):
            role = "User" if msg.get("role") == "user" else "AI"
            formatted_history += f"{role}: {msg.get('content', '')}\n"
    response = _rag_chain_instance.invoke({"question": message, "history": formatted_history})
    yield response
