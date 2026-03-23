import sys
import os
import json
import chromadb
from chromadb.utils import embedding_functions

def search(query, n_results=16):
    # Setup paths
    persist_dir = os.path.join(os.path.dirname(__file__), "../vector_db/chroma_db")
    
    # Initialize client
    client = chromadb.PersistentClient(path=persist_dir)
    collection = client.get_collection(name="flxt_documents")
    
    # Use default embedding function or specific one
    results = collection.query(
        query_texts=[query],
        n_results=int(n_results),
        include=["documents", "metadatas", "distances"]
    )
    
    print(json.dumps(results))

if __name__ == "__main__":
    if len(sys.argv) > 1:
        search(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else 16)
    else:
        print(json.dumps({"error": "No query provided"}))
