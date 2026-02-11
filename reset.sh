#!/bin/bash
# Reset script - Clears all data for fresh start

echo "🔄 Resetting Agentic Study Buddy..."

# Clear database
echo "📦 Clearing database..."
rm -f /Users/swayam/agenticai_/backend/data/chat.db
rm -f /Users/swayam/agenticai_/backend/data/memory*

# Recreate data directory
mkdir -p /Users/swayam/agenticai_/backend/data

echo "✅ Database cleared"
echo "💡 Note: Clear browser localStorage manually:"
echo "   1. Open browser DevTools (F12)"
echo "   2. Application/Storage tab"
echo "   3. Clear 'agentic-study-session' key"
echo ""
echo "🚀 Ready for fresh start!"
