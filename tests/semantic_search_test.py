import os
import vector_db.config
sample_query = "Show me Temperature of Arabian Sea in the year 2016"
query_embedding = EMBEDDING_MODEL.encode(sample_query);
print(query_embedding)