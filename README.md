# ⚖️ Haqooq AI: Your Personal Pakistani Legal Advisor
**Kaggle 5-Day AI Agents Capstone Project**

![Haqooq AI Preview](https://img.shields.io/badge/Status-Completed-success) ![License](https://img.shields.io/badge/License-MIT-blue) ![Python](https://img.shields.io/badge/Python-3.9+-blue) ![Tech](https://img.shields.io/badge/Tech-React%20%7C%20FastAPI%20%7C%20Groq%20%7C%20ChromaDB-blueviolet)

## 📖 The Project Story
Access to justice is a fundamental human right, yet in Pakistan, obtaining reliable legal counsel is often prohibitively expensive, intimidating, and difficult for the average citizen. People often rely on word-of-mouth or unverified internet searches to understand their basic legal rights regarding property, family disputes, cybercrime, or criminal law.

**Haqooq AI** (meaning "Rights" in Urdu) was built to bridge this gap. It is a highly specialized, locally-aware AI Legal Agent designed to provide instant, accurate, and 100% confidential legal advice sourced *strictly* from the official Constitution, Penal Code of Pakistan, Family Laws, and Cybercrime Laws (PECA 2016). 

By democratizing access to legal information, Haqooq AI serves as a first-responder for legal queries, allowing citizens to understand their standing before they ever step foot in a lawyer's office.

---

## 🎯 How It Fulfills the Kaggle AI Agents Course Criteria
This project moves beyond simple LLM wrappers by implementing a structured, agentic workflow:
1. **Meaningful Real-World Problem:** Tackles the massive access-to-justice gap in developing nations.
2. **RAG-Powered Agent (Retrieval-Augmented Generation):** Utilizes a local `ChromaDB` vector store loaded with actual Pakistani legal datasets. The agent does not rely on its pre-trained weights; it actively retrieves and cites local laws.
3. **Strict Constraints & Anti-Hallucination:** The agent operates under a strict system prompt. If a user asks a question outside the ingested legal context (e.g., "How do I get a Canadian Visa?"), the agent explicitly refuses to answer, preventing dangerous legal hallucinations.
4. **Multi-Modal & Bilingual Capabilities:** Features Whisper (Speech-to-Text) with custom language fallback to perfectly detect Urdu/English voice notes, and `edge-tts` to read advice back to the user. The agent intelligently replies in the EXACT language the user spoke (Pure English -> Pure English, Roman Urdu -> Roman Urdu).
5. **Practical & Shareable:** Built as a complete SaaS-style Single Page Application (React, Vite, Framer Motion) with session memory and audio capabilities.

---

## 🏗️ System Architecture & Tech Stack

The application is built on a modern, decoupled architecture designed for high performance and low latency.

*   **Frontend UI:** `React` + `Vite` + `Framer Motion` (for animations) + `Lucide React` (for icons) + `React Markdown`. Offers a premium "Consultation Room" experience with dynamic microphone visual feedback.
*   **Backend API:** `FastAPI` (Python) handles the LangChain workflow, audio-to-text processing, text-to-speech generation, and database querying. Exposes robust `/chat/text` and `/chat/audio` endpoints.
*   **Vector Database:** `ChromaDB` operates locally to store and retrieve dense vector embeddings.
*   **Embeddings Model:** HuggingFace's `sentence-transformers/all-MiniLM-L6-v2` runs locally to generate embeddings.
*   **LLM Engine:** `llama-3.1-8b-instant` via the **Groq API** for lightning-fast, ultra-low latency reasoning.
*   **Speech-to-Text:** `whisper-large-v3` (via Groq API) with custom fallback logic to accurately transcribe both English and Pakistani Urdu without cross-language hallucination.
*   **Text-to-Speech:** `edge-tts` generates localized natural voice responses (`ur-PK-UzmaNeural` for Urdu, `en-US-AriaNeural` for English).

---

## 📊 Datasets Ingested

Haqooq AI does not hallucinate because it is bound to the following ingested datasets:
1. **Criminal & Family Law:** Sourced from HuggingFace (`heyIamUmair/pakistani-law-family-criminal-property`), covering the Pakistan Penal Code, Police Law, and Muslim Family Laws Ordinance 1961.
2. **Constitutional Law:** Sourced from HuggingFace (`AyeshaJadoon/Pakistan_Laws_Dataset`).
3. **Cybercrime Law (PECA 2016):** Direct PDF ingestion of the Prevention of Electronic Crimes Act 2016 and FIA Cybercrime Wing procedural rules, allowing the AI to guide users on digital harassment and hacking cases.

---

## ✨ Core Features
- **📚 Verified Context Only:** Bound strictly to Pakistani Law. The AI explicitly refuses to answer out-of-context or non-legal questions.
- **🗣️ Bilingual Voice Support & TTS:** Talk to the agent in Urdu or English via the microphone. Custom prompts ensure Whisper accurately transcribes Pakistani Urdu, and the agent reads the answer back to you using native Text-to-Speech (TTS).
- **🧠 Multi-Session Memory:** Manage multiple independent legal consultations (chat history) simultaneously.
- **🎯 Dynamic Formatting:** Legal advice is presented cleanly using Markdown, with required documents listed as bullet points and clickable Google Search reference links provided automatically.

---

## 🚀 How to Run Locally

### Prerequisites
- Python 3.9+
- Node.js (v18+)
- A free API key from [Groq](https://console.groq.com/)

### 1. Backend Setup
```bash
# Clone the repository and navigate to the project folder
git clone https://github.com/osamanoor17/haqooq.git
cd haqooq

# Create and activate a virtual environment
python -m venv venv
venv\Scripts\activate  # On Windows (use `source venv/bin/activate` on Mac/Linux)

# Install dependencies
pip install -r requirements.txt

# Create a .env file in the root directory and add your Groq API key:
# echo "GROQ_API_KEY=gsk_your_api_key_here" > .env
# echo "CHROMA_PERSIST_DIR=./data/chroma_db" >> .env

# Ingest the legal datasets into the local Vector DB (Run this only once!)
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
The backend API docs will be available at `http://localhost:8000/docs`.

---

## 🔮 Future Scope
- **Integration with Live Courts:** Connect to high court APIs to track case statuses.
- **WhatsApp Bot Integration:** Allow users in rural areas to access Haqooq AI directly via WhatsApp voice notes.

---
*Built with ❤️ for the Kaggle AI Agents Intensive Course.*
