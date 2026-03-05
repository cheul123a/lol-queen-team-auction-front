#!/bin/bash
curl -s http://localhost:28281/v3/api-docs | jq '.' > current_api_docs.json
echo "API docs saved to current_api_docs.json"
