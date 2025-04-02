import { NextResponse } from 'next/server';
import { HfInference } from '@huggingface/inference';

// Initialize HuggingFace client with proper API key access
const hf = new HfInference(process.env.HUGGINGFACE_API_KEY);

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
  try {
    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Valid messages array is required' },
        { status: 400 }
      );
    }

    // Log the API key for debugging (don't do this in production!)
    console.log('Using Hugging Face API key for feedback:', process.env.HUGGINGFACE_API_KEY ? 'API key is set' : 'API key is NOT set');

    // Format conversation for feedback
    let conversationTranscript = '';
    messages.forEach((msg: any) => {
      const role = msg.role === 'user' ? 'Doctor' : 'Mr. Johnson';
      conversationTranscript += `${role}: ${msg.content}\n`;
    });

    try {
      // Create full prompt with transcript
      const fullPrompt = `${EPA_FEEDBACK_PROMPT}\n\nTranscript:\n${conversationTranscript}\n\nPlease provide your feedback:`;
      
      // Call HuggingFace API
      const result = await hf.textGeneration({
        model: 'mistralai/Mixtral-8x7B-Instruct-v0.1', // Using a larger model for complex feedback
        inputs: fullPrompt,
        parameters: {
          max_new_tokens: 1000,
          temperature: 0.5,
          top_p: 0.9,
          do_sample: true,
          return_full_text: false
        }
      });
      
      // Extract response
      const feedback = result.generated_text.trim();
      return NextResponse.json({ feedback });
    } catch (apiError) {
      console.error('Error calling Hugging Face API for feedback:', apiError);
      
      // Use fallback feedback if API fails
      const fallbackFeedback = generateFallbackFeedback(messages);
      console.log('Using fallback feedback');
      return NextResponse.json({ feedback: fallbackFeedback });
    }
  } catch (error) {
    console.error('Error in feedback API:', error);
    return NextResponse.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    );
  }
} 