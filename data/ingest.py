import os
import io
import time
import requests
import pandas as pd
from datasets import load_dataset
from pypdf import PdfReader
from pinecone import Pinecone, ServerlessSpec
from langchain_pinecone import PineconeVectorStore
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from dotenv import load_dotenv

load_dotenv()

PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME", "haqooq-legal-db")

class PineconeCloudEmbeddings:
    """
    100% Cloud-based embeddings using Pinecone Inference API (multilingual-e5-large).
    Zero local CPU/GPU/RAM load on your laptop. Includes rate-limit retry.
    """
    def __init__(self, pinecone_api_key: str, model: str = "multilingual-e5-large"):
        self.pc = Pinecone(api_key=pinecone_api_key)
        self.model = model

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        all_embeddings = []
        batch_size = 40  # Smaller batch size to prevent hitting 250k token per min limit
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch = [t if t.strip() else " " for t in batch]
            
            # Retry loop for rate-limits (HTTP 429)
            for attempt in range(5):
                try:
                    res = self.pc.inference.embed(
                        model=self.model,
                        inputs=batch,
                        parameters={"input_type": "passage"}
                    )
                    all_embeddings.extend([item["values"] for item in res])
                    break
                except Exception as e:
                    if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                        print(f"Rate limit reached. Pausing for 5 seconds (attempt {attempt + 1}/5)...", flush=True)
                        time.sleep(5)
                    else:
                        raise e
            time.sleep(1.5)  # Pace requests slightly
        return all_embeddings

    def embed_query(self, text: str) -> list[float]:
        clean_text = text if text.strip() else " "
        for attempt in range(5):
            try:
                res = self.pc.inference.embed(
                    model=self.model,
                    inputs=[clean_text],
                    parameters={"input_type": "query"}
                )
                return res[0]["values"]
            except Exception as e:
                if "429" in str(e) or "RESOURCE_EXHAUSTED" in str(e):
                    time.sleep(3)
                else:
                    raise e
        raise RuntimeError("Failed to embed query after retries.")

def ingest_data():
    if not PINECONE_API_KEY:
        print("ERROR: PINECONE_API_KEY is missing from .env file.", flush=True)
        return

    pc = Pinecone(api_key=PINECONE_API_KEY)
    
    # 1. Initialize or reset Pinecone Index
    indexes = [idx.name for idx in pc.list_indexes()]
    if PINECONE_INDEX_NAME in indexes:
        idx_info = pc.describe_index(PINECONE_INDEX_NAME)
        if idx_info.dimension != 1024:
            print(f"Recreating Pinecone index '{PINECONE_INDEX_NAME}' for 1024-dim cloud embeddings...", flush=True)
            pc.delete_index(PINECONE_INDEX_NAME)
            indexes.remove(PINECONE_INDEX_NAME)

    if PINECONE_INDEX_NAME not in indexes:
        print(f"Creating Serverless Pinecone Index '{PINECONE_INDEX_NAME}' (1024-dim multilingual-e5-large)...", flush=True)
        pc.create_index(
            name=PINECONE_INDEX_NAME,
            dimension=1024,
            metric="cosine",
            spec=ServerlessSpec(cloud="aws", region="us-east-1")
        )
        print("Index created successfully!", flush=True)

    documents = []
    
    print("Loading Primary Law dataset from HuggingFace (heyIamUmair/pakistani-law-family-criminal-property)...", flush=True)
    try:
        ds = load_dataset("heyIamUmair/pakistani-law-family-criminal-property", split="train")
        df = ds.to_pandas()
        print(f"Loaded {len(df)} primary law records from HuggingFace.", flush=True)
        for _, row in df.iterrows():
            content = "\n".join([f"{col}: {val}" for col, val in row.items() if pd.notna(val)])
            metadata = {"source": "Pakistani_Laws_Database"}
            documents.append(Document(page_content=content, metadata=metadata))
    except Exception as e:
        print(f"Error loading primary law dataset: {e}", flush=True)

    print("Loading Cybercrime PDFs (PECA & FIA Rules)...", flush=True)
    pdf_urls = [
        "https://nacta.gov.pk/wp-content/uploads/2017/08/Prevention-of-Electronic-Crimes-Act-2016.pdf",
        "https://na.gov.pk/uploads/documents/679b243193585_457.pdf"
    ]
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }

    for url in pdf_urls:
        try:
            print(f"Downloading PDF from {url}...", flush=True)
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            
            pdf_file = io.BytesIO(response.content)
            reader = PdfReader(pdf_file)
            print(f"Extracting {len(reader.pages)} pages...", flush=True)
            
            pdf_text = ""
            for i, page in enumerate(reader.pages):
                text = page.extract_text()
                if text:
                    pdf_text += f"\n--- Page {i+1} ---\n{text}"
                    
            if pdf_text.strip():
                source_name = str(url.split('/')[-1])
                enriched_text = f"Law: Prevention of Electronic Crimes Act (PECA) / FIA Cybercrime Law\n{pdf_text}"
                documents.append(Document(page_content=enriched_text, metadata={"source": source_name}))
                print(f"Successfully loaded {source_name}", flush=True)
                
        except Exception as e:
            print(f"Error loading PDF {url}: {e}", flush=True)

    if not documents:
        print("No documents were loaded. Exiting.", flush=True)
        return

    print(f"Total documents loaded: {len(documents)}. Splitting text into chunks...", flush=True)
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000, 
        chunk_overlap=100
    )
    chunks = text_splitter.split_documents(documents)
    print(f"Created {len(chunks)} chunks.", flush=True)

    print("Initializing Pinecone Cloud Embeddings (100% Zero-RAM Cloud Inference)...", flush=True)
    embeddings = PineconeCloudEmbeddings(pinecone_api_key=PINECONE_API_KEY)

    print("Connecting to Pinecone Vector Database Cloud...", flush=True)
    vectorstore = PineconeVectorStore(
        index_name=PINECONE_INDEX_NAME,
        embedding=embeddings,
        pinecone_api_key=PINECONE_API_KEY
    )
    
    batch_size = 40
    total_batches = (len(chunks) + batch_size - 1) // batch_size
    print(f"Uploading {len(chunks)} chunks to Pinecone Cloud in {total_batches} batches...", flush=True)
    
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        print(f"Uploading batch {i // batch_size + 1}/{total_batches} ({len(batch)} chunks)...", flush=True)
        vectorstore.add_documents(documents=batch)
        time.sleep(1)  # Pace requests between batches
    
    print(f"🎉 Ingestion Complete! All data uploaded to Pinecone Cloud ({PINECONE_INDEX_NAME}).", flush=True)

if __name__ == "__main__":
    ingest_data()
