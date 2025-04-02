// Test script for ElevenLabs API connectivity
// Run with: node test-elevenlabs.js

require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
const http = require('https');

console.log('=== ElevenLabs API Test ===');

// Check API Key from both environment files
console.log('Checking environment files:');

// Check .env.local
const envLocalKey = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY;
console.log('.env.local key present:', envLocalKey ? 'Yes' : 'No');
if (envLocalKey) {
  console.log('.env.local key prefix:', envLocalKey.substring(0, 3) + '...');
}

// Check root .env (manually)
try {
  const rootEnvContent = fs.readFileSync('../.env', 'utf8');
  const rootEnvLines = rootEnvContent.split('\n');
  let rootApiKey = null;
  
  for (const line of rootEnvLines) {
    if (line.includes('ELEVEN_API_KEY=')) {
      rootApiKey = line.split('=')[1].trim();
      break;
    }
  }
  
  console.log('Root .env key present:', rootApiKey ? 'Yes' : 'No');
  if (rootApiKey) {
    console.log('Root .env key prefix:', rootApiKey.substring(0, 3) + '...');
  }
  
  // If we only have root key, use that
  if (!envLocalKey && rootApiKey) {
    console.log('Using API key from root .env file');
    process.env.ELEVEN_API_KEY = rootApiKey;
  }
} catch (err) {
  console.log('Could not read root .env file', err.message);
}

// Determine the final API key to use
const apiKey = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY;

if (!apiKey) {
  console.error('ERROR: No ElevenLabs API key found');
  console.log('Make sure you have added your API key to .env.local or .env file:');
  console.log('ELEVEN_API_KEY=your_api_key_here');
  process.exit(1);
}

console.log('Final API Key to use:', apiKey.substring(0, 3) + '...' + apiKey.substring(apiKey.length - 3));

// Test function to call ElevenLabs directly
async function testElevenLabsApi() {
  console.log('\nTesting ElevenLabs API connection...');
  
  // Use Josh voice ID
  const voiceId = "TxGEqnHWrfWFTfGW9XjX";
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  
  // Headers
  const headers = {
    "Accept": "audio/mpeg",
    "Content-Type": "application/json",
    "xi-api-key": apiKey
  };
  
  // Request data
  const data = {
    "text": "This is a test of the ElevenLabs API. Can you hear me clearly?",
    "model_id": "eleven_monolingual_v1",
    "voice_settings": {
      "stability": 0.5,
      "similarity_boost": 0.5
    }
  };
  
  return new Promise((resolve, reject) => {
    console.log('Preparing request to ElevenLabs...');
    
    // Create request options
    const options = {
      method: 'POST',
      headers: headers,
    };
    
    console.log('Sending request to:', url);
    console.time('apiCall');
    
    // Send request
    const req = http.request(url, options, (res) => {
      console.log('Response status:', res.statusCode);
      console.log('Response headers:', res.headers);
      
      // Check if response is successful
      if (res.statusCode !== 200) {
        console.timeEnd('apiCall');
        let errorData = '';
        res.on('data', (chunk) => {
          errorData += chunk;
        });
        res.on('end', () => {
          console.error('Error response:', errorData);
          reject(new Error(`API request failed with status ${res.statusCode}: ${errorData}`));
        });
        return;
      }
      
      // Collect audio data
      const chunks = [];
      res.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      // Process the complete response
      res.on('end', () => {
        console.timeEnd('apiCall');
        const audioBuffer = Buffer.concat(chunks);
        console.log('Received audio data size:', audioBuffer.length, 'bytes');
        
        // Save the audio file
        fs.writeFileSync('test-audio.mp3', audioBuffer);
        console.log('Audio saved to test-audio.mp3');
        
        resolve('API test successful');
      });
    });
    
    // Handle request errors
    req.on('error', (error) => {
      console.timeEnd('apiCall');
      console.error('Request error:', error);
      reject(error);
    });
    
    // Send the data
    console.log('Sending request data:', JSON.stringify(data));
    req.write(JSON.stringify(data));
    req.end();
  });
}

// Run the test
testElevenLabsApi()
  .then(result => {
    console.log('\n', result);
    console.log('\nConnection test PASSED ✅');
  })
  .catch(error => {
    console.error('\nAPI Test FAILED ❌');
    console.error('Error:', error.message);
    process.exit(1);
  }); 