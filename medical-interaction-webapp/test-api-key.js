// Simple script to test if environment variables are loaded correctly
require('dotenv').config({ path: './.env.local' });

console.log('Testing environment variables:');
console.log('HUGGINGFACE_API_KEY present:', process.env.HUGGINGFACE_API_KEY ? 'Yes' : 'No');
console.log('HUGGINGFACE_API_KEY prefix:', process.env.HUGGINGFACE_API_KEY ? process.env.HUGGINGFACE_API_KEY.substring(0, 3) + '...' : 'None');

// Instructions for the user:
console.log('\nIf the API key is not present or does not start with "hf_", please:');
console.log('1. Ensure your .env.local file contains the correct API key');
console.log('2. Make sure the API key starts with "hf_"');
console.log('3. Restart your Next.js server after updating the .env.local file'); 