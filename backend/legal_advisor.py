import os
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnablePassthrough
from langchain_core.output_parsers import StrOutputParser
from operator import itemgetter
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./data/chroma_db")

# Global variables for models (loaded once)
_rag_chain = None
_groq_client = None

def init_rag_chain():
    global _rag_chain, _groq_client
    if _rag_chain is not None:
        return _rag_chain
        
    print("Initializing AI models... This might take a few seconds.")
    # Initialize embeddings
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

    # Initialize Groq LLM
    llm = ChatGroq(model="llama-3.1-8b-instant", temperature=0.2)
    _groq_client = Groq()
    
    # Load ChromaDB
    vectorstore = Chroma(
        persist_directory=CHROMA_PERSIST_DIR, 
        embedding_function=embeddings
    )
    
    # Create a retriever to get top 4 relevant legal documents
    retriever = vectorstore.as_retriever(search_kwargs={"k": 4})
    
    template = """
    You are 'Haqooq', a highly knowledgeable Pakistani legal advisor AI.
    
    CRITICAL INSTRUCTIONS:
    1. STRICT CONTEXTUAL LIMITATION: You MUST ONLY answer based on the provided Context. If the context does not contain relevant laws or information to answer the user's query, you MUST explicitly state: "Mujhe is bare mein maloomat nahi hain. Main sirf unhi kanooni dastawezat ki bunyad par jawab de sakta hoon jo mere database mein mojood hain." (or equivalent in the user's language). Do NOT use your general knowledge or external information under any circumstances.
    2. STRICT LANGUAGE MATCHING: 
       - If the user wrote in English, you MUST reply in English. 
       - If the user wrote in ROMAN URDU (Urdu words written with English alphabets, e.g., "mera masla yeh hai"), you MUST reply in ROMAN URDU using the English alphabets. Do NOT use Urdu script.
       - STRICT VOCABULARY RULE: When speaking Urdu/Roman Urdu, you MUST use Pakistani Urdu vocabulary. Absolutely DO NOT use Hindi words (e.g., do NOT use 'vyaakti', 'anusaar', 'vishesh', 'samay', 'adhikar'). Instead, use Urdu words ('shakhs', 'mutabiq', 'khas', 'waqt', 'haq').
       - If the user wrote in PROPER URDU SCRIPT (e.g., "میرا مسئلہ یہ ہے"), you MUST reply in proper Urdu script.
    3. MAXIMUM LENGTH: Your entire advice MUST be extremely short. Do NOT exceed 5-6 lines. This is a strict constraint.
    4. REQUIRED DOCUMENTS: If your answer contains a legal procedure, explicitly list any legal documents required (e.g., Affidavits, FIR copies) under a "Required Documents:" heading. If you cannot answer the query because it's out of context, DO NOT include this section.
    5. REFERENCES: If you provide legal advice, include a "References" section at the end with a clickable Google Search hyperlink. Example: [Pakistan Penal Code, Section 154](https://www.google.com/search?q=Pakistan+Penal+Code+Section+154). If you cannot answer the query because it's out of context, DO NOT include this section.
    6. CONVERSATION FLOW: You must read the 'Previous Chat History' to understand the 'Current User Scenario'. Treat the current question as a continuation of the ongoing conversation.
    
    Previous Chat History:
    {history}

    Context (Relevant Laws with Sources from Database):
    {context}

    Current User Scenario:
    {question}
    
    Your Advice:
    """
    prompt = PromptTemplate.from_template(template)
    
    def format_docs(docs):
        formatted_docs = []
        for doc in docs:
            source = doc.metadata.get("source", "Unknown Source")
            formatted_docs.append(f"[Source: {source}]\n{doc.page_content}")
        return "\n\n".join(formatted_docs)

    def combine_for_retrieval(inputs):
        return f"{inputs['history']}\nUser's Current Scenario: {inputs['question']}"

    # Build the RAG chain
    _rag_chain = (
        {
            "context": combine_for_retrieval | retriever | format_docs, 
            "question": itemgetter("question"), 
            "history": itemgetter("history")
        }
        | prompt
        | llm
        | StrOutputParser()
    )
    print("AI models initialized successfully!")
    return _rag_chain

def get_legal_advice(message, history):
    """
    Generator function for Gradio ChatInterface.
    Yields the response incrementally to create a streaming effect.
    """
    try:
        chain = init_rag_chain()
    except Exception as e:
        yield f"Initialization Error: {e}"
        return

    user_query = message if message else ""
            
    if not user_query.strip():
        yield "Please provide a query."
        return
        
    if not os.path.exists(CHROMA_PERSIST_DIR):
        yield "Error: Database not found. Please run 'python data/ingest.py' first."
        return
        
    try:
        # Format history
        formatted_history = ""
        for msg in history:
            if isinstance(msg, dict):
                role = "User" if msg.get("role") == "user" else "AI"
                formatted_history += f"{role}: {msg.get('content', '')}\n"
            else:
                formatted_history += f"User: {msg[0]}\nAI: {msg[1]}\n"
                
        # Stream the response chunk by chunk
        response = ""
        for chunk in chain.stream({"question": user_query, "history": formatted_history}):
            response += chunk
            yield response
    except Exception as e:
        yield f"\nAn error occurred while processing your request: {e}\n\nPlease make sure your GROQ_API_KEY is correctly set in the .env file."
