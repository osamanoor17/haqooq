import os
import pandas as pd
from datasets import load_dataset
from langchain_chroma import Chroma
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter
from dotenv import load_dotenv

load_dotenv()

CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./data/chroma_db")
os.makedirs(CHROMA_PERSIST_DIR, exist_ok=True)

def ingest_data():
    documents = []
    
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

    print("Initializing embedding model...")
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

    print("Creating Chroma vector database. This may take a moment...")
    vectorstore = Chroma.from_documents(
        documents=chunks,
        embedding=embeddings,
        persist_directory=CHROMA_PERSIST_DIR
    )
    
    print(f"Ingestion complete! Vector DB persisted at {CHROMA_PERSIST_DIR}")

if __name__ == "__main__":
    ingest_data()
