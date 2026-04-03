Hey there!!!!

I'm building an application (Floatchat AI - RAG + MCP Architecture based)

## About the project:

-> The current platform allows users to get access over the oceanographic data which is stored in complex NetCDF Formats
-> This platform provides a chat interface for the user interaction
-> I'm demonstrating this Proof of Concept for Indian Ocean

## Current Progress of the project:

-> The Complex NetCDF (.nc files) are preprocessed and converted into JSON objects and are stored in MongoDB database
-> Wrote few MCP Tools to fetch the data from the MongoDB server
-> Connections are established

## Your Task:

-> Build the application with the following Hybrid RAG + MCP Architecture
-> Refer to HLD.jpeg and LLD.jpeg for the architecture diagrams and About the Architecture written below
-> For fetching the data from the mongoDB server, write MCP Tools
-> Do Semantic Search/ MCP Tool call/ both based on the result of LLM query router
-> Combine those results using the LLM result combiner
-> Do visualization (if and only if the user asks for)
-> Render the response back to the frontend chat interface
-> I wrote the vector database in python refer (vector_db), but now I'm writing the service in JS (the semantic search is not working fix that)

## About the Architecture:

-> User gives the query
-> There should be an intent classifier or router which classifies to do what type of search (from MCP Tools i.e MongoDB or Semantic Search (RAG Pipeline) or Both). Refer to below examples

1. ID, Latit, Long, Date => There in Vector Database

How many floats measured data in the year 2025 (01-01-2025 to 31-12-2025) = >Semantic Search

If user asks the data from them, then get all those id's from the Semantic Search
And use the MCP Tools to get the data from the MongoDB server

2. Give temp, pres and psal of the id 1900121

\_id: 1900121 -> Need the measurements array
Call the MCP Tool to get the data

3. Give the measurements in the Arabian Sea for the year 2024

Arabian Sea = [lat = 9876, lon = 099], Bay of Bengal, ..... and so on
Do Semantic Search -> \_id fetched successfully
Reranker -> Top K results => Cutshort them by using Reranker
Call the MCP Tool based on \_id fetched from the Semantic Search
Got the Result
-> Now after getting those results, combine these results (Merge + remove duplicates + Ground reasoning)
-> Check for keywords in the user query (like Visualize, Plot, draw, Compare and so on which are related to visualizations). If they are found in the user's query call the Visualization MCP Tool with the data which you have in your hand
-> Render the response back to the user (in the chat interface page).

## Technologies to be used:

-> Write the code in JavaScript for MCP Servers, tools and Vector service for semantic search under backend/server/services folder

Refer to /data for data ingestion (into MongoDB)
Refer to /vector_db for creating embeddings and store in chroma_data folder

## Important Note:

-> If you are confused and not clear to make decisions, feel free to ask me, don't assume things.
-> Don't assume things and do
-> Be clear

## Issues to be fixed:

-> Vector Service is not working - fix this
-> Fix Data Explorer UI Interface(Table)
-> Any further things you feel let me know, I'll approve
