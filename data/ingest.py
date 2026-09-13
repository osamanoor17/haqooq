import os
import io
import requests
import pandas as pd
from datasets import load_dataset
from pypdf import PdfReader
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings
import shutil
from langchain_text_splitters import RecursiveCharacterTextSplitter
from dotenv import load_dotenv

load_dotenv()

CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./data/chroma_db")

def ingest_data():
    documents = []
    
    if os.path.exists(CHROMA_PERSIST_DIR):
        print(f"Cleaning existing database directory at {CHROMA_PERSIST_DIR}...")
        try:
            shutil.rmtree(CHROMA_PERSIST_DIR)
        except Exception as e:
            print(f"Notice: {e}")
    os.makedirs(CHROMA_PERSIST_DIR, exist_ok=True)
    
    print("Loading Primary Law dataset from HuggingFace...")
    csv_files = [
        "data/2-limitation-act-1908-pdf_extracted.csv",
        "data/Code_of_Criminal_Procedure_Structured upto 16 chapter.csv",
        "data/Muslim_Family_Laws_Ordinance_1961.csv",
        "data/Pakistan_Penal_Code.csv",
        "data/Police_law.csv",
        "data/Transfer property.csv",
        "data/qanun-e-shahadat_1984.csv"
    ]
    
    for file in csv_files:
        try:
            print(f"Loading {file}...")
            ds = load_dataset(
                "heyIamUmair/pakistani-law-family-criminal-property",
                data_files=file, 
                split="train"
            )
            df = ds.to_pandas()
            for _, row in df.iterrows():
                content = "\n".join([f"{col}: {val}" for col, val in row.items() if pd.notna(val)])
                metadata = {"source": file.split('/')[-1]}
                documents.append(Document(page_content=content, metadata=metadata))
        except Exception as e:
            print(f"Error loading {file}: {e}")

    print("Loading Constitution and Broader Laws from HuggingFace...")
    try:
        laws_ds = load_dataset("AyeshaJadoon/Pakistan_Laws_Dataset", split="train")
        df_laws = laws_ds.to_pandas()
        print(f"Loaded {len(df_laws)} records from Constitution/Laws.")
        for _, row in df_laws.iterrows():
            content = str(row.get('content', ''))
            file_name = str(row.get('file_name', 'Pakistan_Law'))
            if content.strip():
                metadata = {"source": file_name}
                documents.append(Document(page_content=content, metadata=metadata))
    except Exception as e:
        print(f"Error loading Constitution dataset: {e}")

    print("Loading Cybercrime PDFs (PECA & FIA Rules)...")
    pdf_urls = [
        "https://nacta.gov.pk/wp-content/uploads/2017/08/Prevention-of-Electronic-Crimes-Act-2016.pdf",
        "https://na.gov.pk/uploads/documents/679b243193585_457.pdf",
        "https://sja.gos.pk/assets/Updated_Laws/The%20Prevention%20of%20Electronic%20Crimes%20Act,%20Rules%20Final%20Index%20(%20Upto%20date%202025).pdf"
    ]
    
    # Fake a standard browser user-agent to avoid HTTP 403 Forbidden errors
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }

    for url in pdf_urls:
        try:
            print(f"Downloading PDF from {url}...")
            response = requests.get(url, headers=headers, timeout=30)
            response.raise_for_status()
            
            pdf_file = io.BytesIO(response.content)
            reader = PdfReader(pdf_file)
            print(f"Extracting {len(reader.pages)} pages...")
            
            pdf_text = ""
            for i, page in enumerate(reader.pages):
                text = page.extract_text()
                if text:
                    pdf_text += f"\n--- Page {i+1} ---\n{text}"
                    
            if pdf_text.strip():
                source_name = url.split('/')[-1]
                # To help the retriever strongly match cybercrime queries, prepend a clear metadata string
                enriched_text = f"Law: Prevention of Electronic Crimes Act (PECA) / FIA Cybercrime Law\n{pdf_text}"
                documents.append(Document(page_content=enriched_text, metadata={"source": source_name}))
                print(f"Successfully loaded {source_name}")
                
        except Exception as e:
            print(f"Error loading PDF {url}: {e}")

    if not documents:
        print("No documents were loaded. Exiting.")
        return

    print(f"Total documents loaded: {len(documents)}. Splitting text into chunks...")
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000, 
        chunk_overlap=100
    )
    chunks = text_splitter.split_documents(documents)
    print(f"Created {len(chunks)} chunks.")

    print("Initializing sentence-transformers/all-MiniLM-L6-v2 embedding model (lightweight & CPU-optimized)...")
    embeddings = HuggingFaceEmbeddings(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True, "batch_size": 64}
    )

    print("Creating Chroma vector database with batched processing to optimize RAM...")
    vectorstore = Chroma(
        persist_directory=CHROMA_PERSIST_DIR,
        embedding_function=embeddings
    )
    
    batch_size = 200
    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        print(f"Ingesting batch {i // batch_size + 1}/{(len(chunks) + batch_size - 1) // batch_size} ({len(batch)} chunks)...")
        vectorstore.add_documents(documents=batch)
    
    print(f"Ingestion complete! Vector DB persisted at {CHROMA_PERSIST_DIR}")

if __name__ == "__main__":
    ingest_data()
