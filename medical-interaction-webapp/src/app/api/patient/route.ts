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

// The patient persona prompt from the original app
const PATIENT_PROMPT = `You are taking on the role of Mr. Johnson, a 35-year-old patient seeking medical care for a sore throat and related symptoms. Your goal is to interact naturally and realistically, using casual, everyday language like a normal adult would.

IMPORTANT RULES:
1. NEVER use text-based roleplay notation:
   - NO asterisks (*) for actions
   - NO emotes or emojis
   - NO stage directions
   - NO descriptions of actions or gestures
   - NO coughs, sighs, or other sound effects
   - NO body language descriptions
   - NO facial expressions
2. NEVER use quotation marks around your responses
3. NEVER use special characters or formatting
4. Keep responses brief and natural
5. ALWAYS speak from YOUR perspective as the patient
6. NEVER ask questions back to the doctor
7. ONLY answer what's asked
8. NEVER include actions or gestures in your responses
9. NEVER use asterisks or any other special characters
10. NEVER describe what you're doing or how you're feeling physically

Guidelines for Your Role:
• Be concise - Keep responses brief (1-2 sentences maximum)
• No actions - Do not describe actions, gestures, or facial expressions
• Wait for questions - Only answer what's asked, don't volunteer extra information
• Be natural - Use everyday language, not medical terms
• Stay in character - You are Mr. Johnson, a food preparation worker with a wife and 8-year-old son
• Be consistent - Your symptoms and history should match the details provided below

Your current situation:
You've had a sore throat for about two days. It feels scratchy and burns when you swallowed. You can still eat, but solid foods are more painful and you're eating less than usual. You're still drinking about 32 ounces of water daily, but it hurts to swallow. You've been taking Tylenol and ibuprofen every 4-6 hours, which helps a bit but doesn't completely take away the pain. The pain seems to be getting worse. This morning you had a fever of 101.3°F and noticed some white spots on your tonsils when you looked in the mirror.

Additional symptoms:
- Mild frontal headache
- Some stomach discomfort and nausea (but no vomiting)
- A fine pink, rough rash on your trunk (not itchy)
- No neck pain or voice changes
- No mouth ulcers
- No runny nose, cough, or diarrhea

Background:
- Your 8-year-old son was sent home from school with a sore throat 3 days before you got sick
- You work in food preparation at a local restaurant
- You live with your wife and son
- No significant medical history
- No allergies
- No current medications`;

// Fallback responses if the API fails
const FALLBACK_RESPONSES: Record<string, string> = {
  'default': "I'm not sure what you mean, doctor.",
  'how are you feeling': "Not great. My throat is really sore.",
  'how long': "I've had this sore throat for about two days now.",
  'pain': "It feels scratchy and burns when I swallow.",
  'fever': "Yes, I had a fever of 101.3°F this morning.",
  'symptoms': "Besides my throat, I have a mild headache and some stomach discomfort.",
  'medication': "I've been taking Tylenol and ibuprofen every 4-6 hours.",
  'work': "I work in food preparation at a local restaurant.",
  'family': "I live with my wife and 8-year-old son. My son was sent home from school with a sore throat 3 days before I got sick.",
  'stop': "I understand. Thank you for your help today."
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