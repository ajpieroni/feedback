// Test script for Hugging Face API connectivity
// Run with: node test-huggingface.js

require('dotenv').config({ path: '.env.local' });
const { HfInference } = require('@huggingface/inference');

console.log('=== Hugging Face API Test ===');

// Check API Key
const apiKey = process.env.HUGGINGFACE_API_KEY;
if (!apiKey) {
  console.error('ERROR: HUGGINGFACE_API_KEY not found in .env.local file');
  console.log('Make sure you have added your API key to the .env.local file:');
  console.log('HUGGINGFACE_API_KEY=your_api_key_here');
  process.exit(1);
}

console.log('API Key found:', apiKey.substring(0, 3) + '...' + apiKey.substring(apiKey.length - 3));
console.log('API Key format valid:', apiKey.startsWith('hf_') ? 'Yes' : 'No');

if (!apiKey.startsWith('hf_')) {
  console.warn('WARNING: API key does not start with "hf_", which is the expected format for Hugging Face API keys');
}

// Test function
async function testHuggingFaceApi() {
  console.log('\nTesting Hugging Face API connection...');
  
  try {
    // Initialize client
    console.log('Initializing HfInference client...');
    const hf = new HfInference(apiKey);
    
    // Test with a simple text generation
    console.log('Sending test request to Mistral model...');
    console.time('apiCall');
    
    const result = await hf.textGeneration({
      model: 'mistralai/Mistral-7B-Instruct-v0.2',
      inputs: 'Hello, how are you?',
      parameters: {
        max_new_tokens: 20,
        return_full_text: false
      }
    });
    
    console.timeEnd('apiCall');
    
    // Display results
    console.log('\nAPI Response:');
    console.log('Status: Success');
    console.log('Response text:', result.generated_text);
    console.log('\nConnection test PASSED ✅');
    
    // Test another model for feedback
    console.log('\nTesting connection to Mixtral model (used for feedback)...');
    console.time('mixtralCall');
    
    try {
      const mixtralResult = await hf.textGeneration({
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
        inputs: 'Write a short medical feedback example.',
        parameters: {
          max_new_tokens: 50,
          return_full_text: false
        }
      });
      
      console.timeEnd('mixtralCall');
      console.log('Mixtral model response:', mixtralResult.generated_text.substring(0, 100) + '...');
      console.log('Mixtral model test PASSED ✅');
    } catch (mixtralError) {
      console.timeEnd('mixtralCall');
      console.error('Mixtral model test FAILED ❌');
      console.error('Error:', mixtralError.message);
    }
    
  } catch (error) {
    console.error('\nAPI Test FAILED ❌');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    if (error.message.includes('401')) {
      console.error('\nAuthentication error: Your API key may be invalid or expired.');
    } else if (error.message.includes('429')) {
      console.error('\nRate limit exceeded: You have made too many requests to the API.');
    } else if (error.message.includes('503')) {
      console.error('\nService unavailable: The Hugging Face API may be experiencing issues.');
    }
    
    process.exit(1);
  }
}

// Run the test
testHuggingFaceApi(); 