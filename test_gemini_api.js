// ===================================
// GEMINI API KEY TEST
// Test if your Gemini API key is working
// ===================================

// Replace with your actual API key
const GEMINI_API_KEY = 'AIzaSyCRP0Ox0OCz3AOgGCx8M-ZYEpmniA-gaUg' // Replace with your actual key

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent'

async function testGeminiAPI() {
  console.log('🧪 Testing Gemini API Key...')
  
  if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
    console.log('❌ ERROR: Please replace YOUR_GEMINI_API_KEY_HERE with your actual API key')
    console.log('1. Get your API key from: https://makersuite.google.com/app/apikey')
    console.log('2. Replace the GEMINI_API_KEY variable in this file')
    console.log('3. Run: node test_gemini_api.js')
    return
  }

  const testPayload = {
    contents: [{
      parts: [{
        text: "Hello, this is a test message. Please respond with 'API test successful' if you can read this."
      }]
    }],
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 50
    }
  }

  try {
    console.log('📡 Making API request...')
    
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    })

    console.log('📊 Response Status:', response.status)
    console.log('📊 Response Headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.log('❌ API Error Response:', errorText)
      
      if (response.status === 400) {
        console.log('🔍 This usually means:')
        console.log('- Invalid API key')
        console.log('- Malformed request')
        console.log('- API key doesn\'t have proper permissions')
      } else if (response.status === 403) {
        console.log('🔍 This usually means:')
        console.log('- API key is invalid or expired')
        console.log('- API key doesn\'t have access to Gemini API')
        console.log('- Billing/quota issues')
      }
      return
    }

    const data = await response.json()
    console.log('✅ API Response:', JSON.stringify(data, null, 2))

    if (data.candidates && data.candidates[0] && data.candidates[0].content) {
      const text = data.candidates[0].content.parts[0].text
      console.log('✅ SUCCESS! Gemini API is working!')
      console.log('📝 Response:', text)
    } else {
      console.log('❌ Unexpected response format')
    }

  } catch (error) {
    console.log('💥 Network Error:', error.message)
    console.log('🔍 This could be:')
    console.log('- Network connectivity issue')
    console.log('- Invalid API key')
    console.log('- API service down')
  }
}

// Alternative test using curl command
console.log(`
🔧 ALTERNATIVE TEST USING CURL:
===============================

If the Node.js test doesn't work, try this curl command:

curl -X POST \\
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "contents": [{
      "parts": [{
        "text": "Hello, this is a test"
      }]
    }]
  }'

Replace YOUR_API_KEY with your actual API key.
`)

// Run the test
testGeminiAPI()

console.log(`
📋 NEXT STEPS:
==============

1. If the API test fails:
   - Check your API key at: https://makersuite.google.com/app/apikey
   - Make sure it's active and has proper permissions
   - Try creating a new API key

2. If the API test succeeds:
   - The issue is in the Edge Function
   - Check the Edge Function logs for errors
   - Verify the environment variable is set correctly

3. Check Edge Function environment variable:
   - Go to Supabase Dashboard → Settings → Edge Functions
   - Verify GEMINI_API_KEY is set correctly
   - Try deleting and re-adding the environment variable
`) 