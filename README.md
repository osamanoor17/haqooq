# ⚖️ Haqooq AI: Your Personal Pakistani Legal Advisor
**Kaggle 5-Day AI Agents Capstone Project**

![Haqooq AI Preview](https://img.shields.io/badge/Status-Completed-success) ![License](https://img.shields.io/badge/License-MIT-blue) ![Tech](https://img.shields.io/badge/Tech-React%20%7C%20FastAPI%20%7C%20Groq%20%7C%20ChromaDB-blueviolet)

## 📖 The Project Story
Access to justice is a fundamental human right, yet in Pakistan, obtaining reliable legal counsel is often prohibitively expensive, intimidating, and difficult for the average citizen. People often rely on word-of-mouth or unverified internet searches to understand their basic legal rights regarding property, family disputes, or criminal law.

**Haqooq AI** (meaning "Rights" in Urdu) was built to bridge this gap. It is a highly specialized, locally-aware AI Legal Agent designed to provide instant, accurate, and 100% confidential legal advice sourced *strictly* from the official Constitution and Penal Code of Pakistan. 

By democratizing access to legal information, Haqooq AI serves as a first-responder for legal queries, allowing citizens to understand their standing before they ever step foot in a lawyer's office.

## 🎯 How It Fulfills the Kaggle AI Agents Course Criteria
This project moves beyond simple LLM wrappers by implementing a structured, agentic workflow:
1. **Meaningful Real-World Problem:** Tackles the massive access-to-justice gap in developing nations.
2. **RAG-Powered Agent (Retrieval-Augmented Generation):** Utilizes a local `ChromaDB` vector store loaded with actual Pakistani legal datasets (Family Law, Property Law, PPC). The agent does not rely on its pre-trained weights; it actively retrieves and cites local laws.
3. **Strict Constraints & Anti-Hallucination:** The agent operates under a strict system prompt. If a user asks a question outside the ingested legal context (e.g., "How do I get a Canadian Visa?"), the agent explicitly refuses to answer, preventing dangerous legal hallucinations.
4. **Multi-Modal Capabilities:** Features Whisper (Speech-to-Text) and Edge-TTS (Text-to-Speech), allowing non-tech-savvy users to speak naturally in Urdu or English and receive spoken legal advice.
5. **Practical & Shareable:** Built as a complete SaaS-style Single Page Application (React) with session memory, case-file generation, and downloadable transcripts.

---

## 🏗️ System Architecture

The application is built on a modern, decoupled architecture:

*   **Frontend (React + Vite):** A responsive, premium UI offering a "Consultation Room" experience. It manages state for multiple chat sessions and handles media recording for voice inputs.
*   **Backend (FastAPI):** A high-performance Python API that orchestrates the LangChain workflow.
*   **Vector Database (ChromaDB):** Operates locally to store and retrieve dense vector embeddings of legal documents using HuggingFace's `all-MiniLM-L6-v2`.
*   **LLM Engine (Groq):** Powered by `llama-3.1-8b-instant` via the Groq API for lightning-fast, ultra-low latency reasoning.

---

## ✨ Core Features
- **📚 Verified Context Only:** Bound strictly to the Pakistan Penal Code and Constitution.
- **🗣️ Bilingual Voice Support:** Talk to the agent in Roman Urdu or English via the microphone.
- **🧠 Multi-Session Memory:** Manage multiple independent legal consultations (chat history) simultaneously, just like ChatGPT.
- **📄 Downloadable Transcripts:** Export your entire consultation as a `.txt` file to share with a human lawyer later.

---

## 🚀 How to Run Locally

### Prerequisites
- Python 3.9+
- Node.js (v18+)
- A free API key from [Groq](https://console.groq.com/)

### 1. Backend Setup
```bash
# Clone the repository and navigate to the project folder
# Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate  # On Windows

# Install dependencies
pip install -r requirements.txt

# Create a .env file in the root directory and add your Groq API key:
# GROQ_API_KEY=gsk_your_api_key_here
# CHROMA_PERSIST_DIR=./data/chroma_db

# Ingest the legal datasets into the local Vector DB
python data/ingest.py

# Start the FastAPI server
python -m uvicorn backend.api:app --reload
```

### 2. Frontend Setup
```bash
# Open a new terminal and navigate to the frontend folder
cd frontend

# Install Node dependencies
npm install

# Start the React development server
npm run dev
```
The application will be available at `http://localhost:5173`.

---
*Built with ❤️ for the Kaggle AI Agents Intensive Course.*
