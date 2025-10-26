#!/bin/bash

# Add Week Bundle to Database
# Usage: ./add-to-database.sh YOUR_USER_ID

USER_ID=$1

if [ -z "$USER_ID" ]; then
  echo "❌ Error: Please provide your user ID"
  echo "Usage: ./add-to-database.sh YOUR_USER_ID"
  echo ""
  echo "To get your user ID:"
  echo "1. Sign in to your app"
  echo "2. Open browser console"
  echo "3. Run: localStorage.getItem('supabase.auth.token')"
  echo "4. Look for 'sub' field in the JWT token"
  exit 1
fi

echo "================================================"
echo "Adding Semaphores & Monitors Bundle to Database"
echo "================================================"
echo "User ID: $USER_ID"
echo ""

# Add userId to the JSON
cat semaphores_data.json | jq --arg uid "$USER_ID" '. + {userId: $uid}' > temp_data.json

# Call the API endpoint
echo "📤 Sending to API..."
curl -X POST http://localhost:5173/api/week/aggregate-content \
  -H "Content-Type: application/json" \
  --data @temp_data.json

# Clean up
rm temp_data.json

echo ""
echo "✅ Done!"


