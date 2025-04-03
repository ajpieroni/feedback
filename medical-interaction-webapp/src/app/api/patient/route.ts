import { NextResponse } from 'next/server';
import { HfInference } from '@huggingface/inference';

// Enhanced debugging
console.log('=== LOADING PATIENT API ROUTE ===');
console.log('Environment check:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('API Key present in patient route:', process.env.HUGGINGFACE_API_KEY ? 'Yes' : 'No');
console.log('API Key prefix:', process.env.HUGGINGFACE_API_KEY ? process.env.HUGGINGFACE_API_KEY.substring(0, 3) + '...' : 'None');
console.log('ElevenLabs API Key present:', process.env.ELEVENLABS_API_KEY ? 'Yes' : 'No');

let hf: HfInference;
try {
  hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
  console.log('HuggingFace client initialized successfully');
} catch (error) {
  console.error('Error initializing HuggingFace client:', error);
  hf = new HfInference(); // Initialize without API key as fallback
}

// Revised patient persona prompt to test doctor skills by being opaque about symptoms
const PATIENT_PROMPT = `You are Mr. Johnson, a 35-year-old patient with a sore throat and related symptoms. Your role is to test the doctor's diagnostic skills. Provide only minimal information and be as vague as possible about your symptoms. Only disclose details when the doctor specifically asks.

Guidelines:
- Speak in the first person as Mr. Johnson.
- Keep responses brief (1–2 sentences maximum).
- Answer only the specific question asked; do not volunteer extra information.
- Do not ask questions back.
- Avoid using special characters, formatting, or emojis.
- Stay in character as a food preparation worker who lives with his wife and 8-year-old son.

Your hidden situation (do not reveal these details unless directly questioned):
- You have had a sore throat for about two days that burns when you swallow, making solid foods uncomfortable.
- You had a mild fever this morning (around 101°F) and noticed something unusual on your tonsils.
- You also experience a mild headache, some stomach discomfort, and a slight rash.
- Your 8-year-old son was recently ill.
- You have no significant medical history, no allergies, and have been taking over-the-counter medication with limited relief.

Disclose details only when directly asked by the doctor, otherwise keep your responses minimal and vague.`;

// Fallback responses if the API fails
const FALLBACK_RESPONSES: Record<string, string> = {
  'default': "I'm not sure what you mean, doctor.",
  'how are you feeling': "I'm okay.",
  'how long': "It's been a couple of days.",
  'pain': "It burns a bit when I swallow.",
  'fever': "I had a bit of a fever this morning.",
  'symptoms': "Just the usual discomfort.",
  'medication': "I've been taking some over-the-counter meds.",
  'work': "I work in food preparation.",
  'family': "I live with my wife and my son.",
  'stop': "I understand. Thank you."
};

export async function POST(request: Request) {
  console.log('=== PATIENT API CALLED ===');
  console.time('patientApiTotalTime');
  
  try {
    console.log('Parsing request body...');
    const body = await request.json();
    const { message, history } = body;
    
    console.log(`Request received - message length: ${message?.length || 0}, history items: ${history?.length || 0}`);

    if (!message) {
      console.error('Request missing message field');
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Log API key status
    console.log('API authentication check:');
    console.log('- HuggingFace API key:', process.env.HUGGINGFACE_API_KEY ? 'Present' : 'Missing');
    console.log('- HuggingFace token format valid:', process.env.HUGGINGFACE_API_KEY?.startsWith('hf_') ? 'Yes' : 'No');

    // Format conversation history for the prompt
    console.log('Formatting conversation history...');
    let conversationHistory = '';
    try {
      history.forEach((msg: any) => {
        const role = msg.role === 'user' ? 'Doctor' : 'Mr. Johnson';
        conversationHistory += `${role}: ${msg.content}\n`;
      });
      console.log('Conversation history formatted successfully');
    } catch (historyError) {
      console.error('Error formatting history:', historyError);
      conversationHistory = ''; // Use empty history as fallback
    }

    // Create full prompt with conversation history
    const fullPrompt = `${PATIENT_PROMPT}\n\nConversation so far:\n${conversationHistory}\nDoctor: ${message}\nMr. Johnson:`;
    console.log('Prompt created, length:', fullPrompt.length);
    console.log('Prompt preview (first 100 chars):', fullPrompt.substring(0, 100) + '...');

    try {
      // Call HuggingFace API
      console.log('Calling HuggingFace API...');
      console.time('huggingFaceApiCall');
      
      const modelName = 'mistralai/Mistral-7B-Instruct-v0.2';
      console.log('Using model:', modelName);
      
      const result = await hf.textGeneration({
        model: modelName,
        inputs: fullPrompt,
        parameters: {
          max_new_tokens: 150,
          temperature: 0.7,
          top_p: 0.9,
          do_sample: true,
          return_full_text: false
        }
      });
      
      console.timeEnd('huggingFaceApiCall');
      console.log('API response received:', !!result);
      
      // Extract and clean response
      let response = result.generated_text.trim();
      console.log('Raw response length:', response.length);
      console.log('Raw response preview:', response.substring(0, 50) + '...');
      
      // Clean up the response to ensure it follows the rules
      console.log('Cleaning response...');
      // Remove any text after detecting end of turn indicators
      const endIndicators = ['Doctor:', 'Mr. Johnson:', '\n\n'];
      for (const indicator of endIndicators) {
        const index = response.indexOf(indicator);
        if (index !== -1) {
          console.log(`Found end indicator "${indicator}" at position ${index}`);
          response = response.substring(0, index).trim();
        }
      }
      
      console.log('Final response length:', response.length);
      console.log('Final response:', response);
      
      console.timeEnd('patientApiTotalTime');
      return NextResponse.json({ response });
    } catch (apiError) {
      console.error('Error calling Hugging Face API:', apiError);
      console.log('API error details:', JSON.stringify(apiError).substring(0, 200) + '...');
      
      // Fallback to pattern matching if API fails
      console.log('Using fallback response system');
      const lowerMessage = message.toLowerCase();
      let fallbackResponse = FALLBACK_RESPONSES['default'];
      
      for (const [keyword, resp] of Object.entries(FALLBACK_RESPONSES)) {
        if (lowerMessage.includes(keyword.toLowerCase())) {
          console.log(`Matched fallback keyword: "${keyword}"`);
          fallbackResponse = resp;
          break;
        }
      }
      
      console.log('Using fallback response:', fallbackResponse);
      console.timeEnd('patientApiTotalTime');
      return NextResponse.json({ response: fallbackResponse });
    }
  } catch (error) {
    console.error('Fatal error in patient API:', error);
    console.log('Error stack:', (error as Error).stack);
    console.timeEnd('patientApiTotalTime');
    return NextResponse.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    );
  }
}