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

// EPA feedback prompt with focus on bedside manner and empathy
const EPA_FEEDBACK_PROMPT = `Analyze the following medical consultation transcript from a SimPatient session and provide detailed, actionable feedback with a focus on developing bedside manner and empathetic communication. This feedback is intended for healthcare professionals working to build confidence in patient interactions. Remember: "Confidence starts with conversation."

Base your evaluation on these components, with special emphasis on empathetic engagement:

1. Building Rapport and Empathy
2. Information Gathering
3. Explanation and Planning
4. Professional Demeanor

For each component, please provide:
- A rating: Poor, Fair, Adequate, Very Good, or Excellent.
- Specific strengths, including concrete examples from the transcript.
- Specific areas for improvement, with actionable suggestions. For example, if the clinician asks "Do you have any questions?" suggest replacing it with "What questions do you have for me?" to invite a more detailed response.

In your feedback, evaluate the clinician's performance against the following criteria:
- **Chief Complaint & History:** Assess whether the clinician effectively asks about pain quality, severity, duration, timing, and factors affecting the pain, as well as associated symptoms and context.
- **Information Gathering:** Confirm that the clinician inquires about medications, allergies, past medical history, family history, and social history, and organizes the information clearly.
- **Assessment and Plan:** Evaluate whether the clinician orders appropriate tests and constructs a logical, justified plan with differential diagnoses, advising against unnecessary tests.
- **Interviewing Style and Bedside Manner:** Focus on the tone, empathy, and communication style. Provide specific recommendations for improving bedside manner—such as rephrasing generic questions ("Do you have any questions?") to more engaging ones ("What questions do you have for me?")—and for consistently demonstrating warmth and respect.

Do not include feedback on active listening since visual cues (e.g., eye contact) are not assessable in this simulation.

Provide your feedback in natural, paragraph-style language that is supportive and encouraging, using phrases such as "You did a good job asking about..." or "Consider improving by...". Incorporate relevant quotes from the conversation.

Format your entire response in Markdown with:
- \`#\` for the main title.
- \`##\` for section headings.
- **Bold** text for emphasis.
- Hyphenated bullet points for lists.
- Adequate spacing between sections.

Your response should be well-structured and designed to help healthcare professionals build their clinical skills, particularly in bedside manner and empathetic communication.
`;

// Fallback feedback if the API fails, emphasizing bedside manner and empathy
const generateFallbackFeedback = (messages: any[]) => {
  const messageCount = messages.length;
  const doctorMessages = messages.filter(msg => msg.role === 'user').length;
  
  return `
# Feedback on Your SimPatient Consultation!!!!!!

As a first-year medical student, every interaction is an opportunity to improve your bedside manner and empathy. Here is some personalized feedback based on your simulated consultation:

## Building Rapport and Empathy
**Rating**: Very Good

You demonstrated a warm, professional approach by clearly introducing yourself and setting a welcoming tone.  
**Strengths**:
- Your greeting was friendly and helped put the patient at ease.
- You clearly stated your role, which is crucial for establishing trust.

**Areas for Improvement**:
- Consider asking more open-ended questions about how the patient feels. For instance, rather than asking "Do you have any questions?" try "What questions do you have for me?" to invite a more detailed response.

## Information Gathering
**Rating**: ${doctorMessages > 5 ? 'Excellent' : 'Adequate'}

You effectively gathered key details about the patient's symptoms, which is essential for forming an accurate diagnosis.  
**Strengths**:
- You asked focused questions regarding the onset, quality, and duration of the pain.
- You collected important background information that provides context.

**Areas for Improvement**:
- Explore the patient's emotional and psychosocial responses to their symptoms for a more holistic view.
- Consider asking additional questions about how the symptoms affect the patient's daily life.

## Explanation and Planning
**Rating**: ${messageCount > 8 ? 'Very Good' : 'Fair'}

Your explanation of the clinical reasoning and next steps was clear and structured.  
**Strengths**:
- You communicated your thought process logically, which helps the patient understand the plan.
- You outlined potential next steps clearly, setting expectations for follow-up.

**Areas for Improvement**:
- Confirm the patient's understanding by explicitly asking if they have any questions.
- Provide more detailed recommendations for follow-up, particularly regarding diagnostic tests or treatment options.

## Professional Demeanor
**Rating**: Excellent

Your professional tone and respectful communication were consistently maintained.  
**Strengths**:
- You maintained a calm and empathetic demeanor throughout the consultation.
- Your language was clear, confident, and conveyed respect for the patient.

**Overall Assessment**:
This consultation shows a strong foundation in clinical communication with a focus on bedside manner. Continue to refine your empathetic engagement and communication style—each interaction is a step toward mastering patient-centered care.
`;
};

// Post-process feedback to ensure proper markdown formatting
const ensureMarkdownFormatting = (feedback: string): string => {
  if (feedback.trim().startsWith('#') || feedback.trim().startsWith('##')) {
    return feedback;
  }
  
  let formattedFeedback = feedback;
  if (!formattedFeedback.includes('# Feedback')) {
    formattedFeedback = `# Feedback on Medical Consultation\n\n${formattedFeedback}`;
  }
  
  const components = [
    'Building Rapport and Empathy',
    'Information Gathering',
    'Explanation and Planning',
    'Professional Demeanor'
  ];
  
  components.forEach(component => {
    const patterns = [
      new RegExp(`${component}\\s*\\n`, 'i'),
      new RegExp(`#+\\s*${component}\\s*\\n`, 'i'),
      new RegExp(`\\d+\\.\\s*${component}\\s*\\n`, 'i')
    ];
    
    let replaced = false;
    for (const pattern of patterns) {
      if (pattern.test(formattedFeedback)) {
        formattedFeedback = formattedFeedback.replace(pattern, `## ${component}\n`);
        replaced = true;
        break;
      }
    }
    
    if (!replaced && formattedFeedback.includes(component)) {
      formattedFeedback = formattedFeedback.replace(
        new RegExp(`(${component})`, 'i'),
        `## $1`
      );
    }
  });
  
  formattedFeedback = formattedFeedback.replace(
    /(Rating|Strengths|Areas for Improvement):/g,
    '**$1**:'
  );
  
  formattedFeedback = formattedFeedback.replace(
    /^(\s*)[•*]\s/gm,
    '$1- '
  );
  
  return formattedFeedback;
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
      const fullPrompt = `${EPA_FEEDBACK_PROMPT}\n\nTranscript:\n${conversationTranscript}\n\nPlease provide your feedback in markdown format with proper headings, bullet points, and emphasis.`;
      console.log('Feedback prompt created, length:', fullPrompt.length);
      
      const modelName = 'mistralai/Mixtral-8x7B-Instruct-v0.1';
      console.log('Using feedback model:', modelName);
      
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
      
      const feedback = result.generated_text.trim();
      console.log('Feedback length:', feedback.length);
      console.log('Feedback preview:', feedback.substring(0, 100) + '...');
      
      const formattedFeedback = ensureMarkdownFormatting(feedback);
      
      console.timeEnd('feedbackApiTotalTime');
      return NextResponse.json({ feedback: formattedFeedback });
    } catch (apiError) {
      console.error('Error calling Hugging Face API for feedback:', apiError);
      console.log('API error details:', JSON.stringify(apiError).substring(0, 200) + '...');
      
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