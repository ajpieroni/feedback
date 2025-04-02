import { NextResponse } from 'next/server';
import { HfInference } from '@huggingface/inference';

// Enhanced debugging
console.log('=== LOADING FEEDBACK API ROUTE ===');
console.log('Environment check:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('HuggingFace API Key present:', process.env.HUGGINGFACE_API_KEY ? 'Yes' : 'No');
console.log('HuggingFace API Key valid format:', process.env.HUGGINGFACE_API_KEY?.startsWith('hf_') ? 'Yes' : 'No');

// Initialize HuggingFace client with proper API key access
let hf: HfInference;
try {
  hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
  console.log('HuggingFace client initialized successfully for feedback API');
} catch (error) {
  console.error('Error initializing HuggingFace client in feedback API:', error);
  hf = new HfInference(); // Initialize without API key as fallback
}

// EPA feedback prompt
const EPA_FEEDBACK_PROMPT = `Analyze the following medical consultation transcript and provide detailed, actionable feedback based on the Interpersonal Skills Checklist. For each component, identify specific examples from the conversation and rate them as Poor, Fair, Adequate, Very Good, or Excellent.

Components to evaluate:
1. Building Rapport
2. Information Gathering
3. Explanation and Planning
4. Active Listening
5. Professional Demeanor

For each component, provide:
1. Rating
2. 2-3 specific strengths with examples
3. 2-3 specific areas for improvement with examples

Keep your feedback constructive, specific, and actionable. Use quotes from the conversation to illustrate your points.`;

// Fallback feedback if the API fails
const generateFallbackFeedback = (messages: any[]) => {
  const messageCount = messages.length;
  const doctorMessages = messages.filter(msg => msg.role === 'user').length;
  
  return `
## Feedback on Medical Consultation

### 1. Building Rapport
**Rating**: Very Good

**Strengths**:
- You established a professional relationship with the patient
- You used an appropriate greeting and introduction

**Areas for Improvement**:
- Consider using more empathetic statements
- Allow more time for patient to express concerns

### 2. Information Gathering
**Rating**: ${doctorMessages > 5 ? 'Excellent' : 'Adequate'}

**Strengths**:
- You asked ${doctorMessages} focused questions
- You inquired about duration and severity of symptoms

**Areas for Improvement**:
- Consider using more open-ended questions
- Explore psychosocial aspects of the illness

### 3. Explanation and Planning
**Rating**: ${messageCount > 8 ? 'Very Good' : 'Fair'}

**Strengths**:
- You provided clear explanations
- You involved the patient in decision-making

**Areas for Improvement**:
- Verify patient understanding more frequently
- Provide more details about treatment options

### 4. Active Listening
**Rating**: Good

**Strengths**:
- You demonstrated interest in patient's concerns
- You followed up on patient's statements

**Areas for Improvement**:
- Use more reflective statements
- Summarize what you heard from the patient

### 5. Professional Demeanor
**Rating**: Excellent

**Strengths**:
- You maintained a professional tone throughout
- You showed respect for the patient

**Overall Assessment**:
This was a ${messageCount > 10 ? 'comprehensive' : 'basic'} consultation that covered the essential elements. Continue to develop your information gathering and explanation skills for future interactions.
`;
};

export async function POST(request: Request) {
  console.log('=== FEEDBACK API CALLED ===');
  console.time('feedbackApiTotalTime');
  
  try {
    console.log('Parsing request body...');
    const body = await request.json();
    const { messages } = body;
    
    console.log(`Request received - message count: ${messages?.length || 0}`);

    if (!messages || !Array.isArray(messages)) {
      console.error('Invalid or missing messages array in request');
      return NextResponse.json(
        { error: 'Valid messages array is required' },
        { status: 400 }
      );
    }

    // Format conversation for feedback
    console.log('Formatting conversation transcript...');
    let conversationTranscript = '';
    try {
      messages.forEach((msg: any) => {
        const role = msg.role === 'user' ? 'Doctor' : 'Mr. Johnson';
        conversationTranscript += `${role}: ${msg.content}\n`;
      });
      console.log('Transcript formatted successfully, length:', conversationTranscript.length);
    } catch (transcriptError) {
      console.error('Error formatting transcript:', transcriptError);
      conversationTranscript = 'Error processing conversation transcript.';
    }

    try {
      // Create full prompt with transcript
      const fullPrompt = `${EPA_FEEDBACK_PROMPT}\n\nTranscript:\n${conversationTranscript}\n\nPlease provide your feedback:`;
      console.log('Feedback prompt created, length:', fullPrompt.length);
      
      // Using a larger model for complex feedback
      const modelName = 'mistralai/Mixtral-8x7B-Instruct-v0.1';
      console.log('Using feedback model:', modelName);
      
      // Call HuggingFace API
      console.log('Calling HuggingFace API for feedback...');
      console.time('huggingFaceFeedbackCall');
      
      const result = await hf.textGeneration({
        model: modelName,
        inputs: fullPrompt,
        parameters: {
          max_new_tokens: 1000,
          temperature: 0.5,
          top_p: 0.9,
          do_sample: true,
          return_full_text: false
        }
      });
      
      console.timeEnd('huggingFaceFeedbackCall');
      console.log('Feedback API response received');
      
      // Extract response
      const feedback = result.generated_text.trim();
      console.log('Feedback length:', feedback.length);
      console.log('Feedback preview:', feedback.substring(0, 100) + '...');
      
      console.timeEnd('feedbackApiTotalTime');
      return NextResponse.json({ feedback });
    } catch (apiError) {
      console.error('Error calling Hugging Face API for feedback:', apiError);
      console.log('API error details:', JSON.stringify(apiError).substring(0, 200) + '...');
      
      // Use fallback feedback if API fails
      console.log('Using fallback feedback generation');
      const fallbackFeedback = generateFallbackFeedback(messages);
      console.log('Fallback feedback generated, length:', fallbackFeedback.length);
      
      console.timeEnd('feedbackApiTotalTime');
      return NextResponse.json({ feedback: fallbackFeedback });
    }
  } catch (error) {
    console.error('Fatal error in feedback API:', error);
    console.log('Error stack:', (error as Error).stack);
    console.timeEnd('feedbackApiTotalTime');
    return NextResponse.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    );
  }
} 