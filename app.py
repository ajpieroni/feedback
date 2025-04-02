import os
import speech_recognition as sr
import ollama
from dotenv import load_dotenv
import json
import time
import subprocess
import pyaudio
import wave
import io

# Load environment variables
load_dotenv()

# Initialize speech recognizer with basic settings
recognizer = sr.Recognizer()
recognizer.energy_threshold = 300
recognizer.dynamic_energy_threshold = True

def listen():
    """Listen for user input and convert to text."""
    try:
        # Explicitly use MacBook Pro Microphone (index 4)
        with sr.Microphone(device_index=4) as source:
            print("\nListening... (speak now)")
            print("Adjusting for ambient noise...")
            recognizer.adjust_for_ambient_noise(source, duration=1)
            print("Ready! Speak clearly into the microphone...")
            
            try:
                audio = recognizer.listen(source, timeout=5)
                print("Audio captured! Processing...")
                
                try:
                    text = recognizer.recognize_google(audio)
                    # print(f"\nYou said: {text}")
                    return text
                except sr.UnknownValueError:
                    print("Sorry, I couldn't understand that. Please try again.")
                    return None
                except sr.RequestError as e:
                    print(f"Could not request results; {e}")
                    print("Please check your internet connection.")
                    return None
            except Exception as e:
                print(f"Error capturing audio: {str(e)}")
                return None
    except Exception as e:
        print(f"Error initializing microphone: {str(e)}")
        return None

# Patient persona prompt
PATIENT_PROMPT = """You are taking on the role of Mr. Johnson, a 35-year-old patient seeking medical care for a sore throat and related symptoms. Your goal is to interact naturally and realistically, using casual, everyday language like a normal adult would.

Guidelines for Your Role:
• Be concise - Keep responses brief (1-2 sentences maximum)
• No actions - Do not describe actions, gestures, or facial expressions
• Wait for questions - Only answer what's asked, don't volunteer extra information
• Be natural - Use everyday language, not medical terms
• Stay in character - You are Mr. Johnson, a food preparation worker with a wife and 8-year-old son
• Be consistent - Your symptoms and history should match the details provided below

Your current situation:
You've had a sore throat for about two days. It feels scratchy and burns when you swallow. You can still eat, but solid foods are more painful and you're eating less than usual. You're still drinking about 32 ounces of water daily, but it hurts to swallow. You've been taking Tylenol and ibuprofen every 4-6 hours, which helps a bit but doesn't completely take away the pain. The pain seems to be getting worse. This morning you had a fever of 101.3°F and noticed some white spots on your tonsils when you looked in the mirror.

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
- No current medications

Remember to:
1. Keep responses brief and to the point
2. Never describe actions or gestures
3. Only answer the specific question asked
4. Use simple, everyday language
5. Stay consistent with your symptoms
6. Don't diagnose yourself or use medical terms

Example of good responses:
- "I've had a sore throat for about two days now."
- "It feels scratchy and burns when I swallow."
- "I've been taking Tylenol and ibuprofen, but they only help a little."
- "I had a fever of 101.3 this morning."

Example of bad responses:
- "*clears throat* So, yeah, I've had this sore throat..."
- "*glances around nervously* And this morning..."
- "*chuckles awkwardly* I've been taking those Tylenol..."
- "*shudders* The pain is getting worse..." """

# EPA feedback prompt
EPA_FEEDBACK_PROMPT = """Analyze the following medical consultation transcript and provide detailed feedback based on the Interpersonal Skills Checklist. For each component, identify specific examples from the conversation and rate them as Poor, Fair, Adequate, Very Good, or Excellent.

IMPORTANT: When referencing specific examples, you MUST include the exact verbatim quote from the transcript in quotation marks, followed by the speaker's name (e.g., "Dr. Alex: [exact quote]" or "Mr. Johnson: [exact quote]").

Components to evaluate:

1. Introduction
- Did the student introduce themselves properly?
- Did they identify the patient by name?
- Was the greeting warm and engaging?
- Include verbatim quotes showing what was done well or could be improved.

2. Questioning Skills
- Use of open-ended questions
- Frequency of interruptions
- Flow and organization of questioning
- Include verbatim quotes demonstrating effective or ineffective questioning.

3. Elicit Patient Perspective
- How well did they understand the patient's explanatory model?
- Did they explore the impact of illness on the patient's well-being?
- How well did they incorporate the patient's viewpoint?
- Include verbatim quotes showing good or missed opportunities.

4. Verbal Communication
- Use of medical jargon
- Organization of thoughts
- Tone of speech
- Include verbatim quotes showing effective or ineffective communication.

5. Non-verbal Communication
- Eye contact
- Physical distance and expressions
- Overall attentiveness
- Include verbatim quotes where non-verbal communication is implied or discussed.

6. Empathy
- Response to emotional cues
- Quality of empathetic responses
- Handling of pain or anxiety
- Include verbatim quotes showing empathetic or missed opportunities.

7. Respect
- Attitude towards the patient
- Partnership establishment
- Sensitivity during examination
- Include verbatim quotes showing respectful or disrespectful behavior.

8. Closure
- Explanation of impression and plan
- Inquiry about remaining questions
- Closing remarks
- Include verbatim quotes showing effective or ineffective closure.

For each component:
1. Rate the performance (Poor, Fair, Adequate, Very Good, Excellent)
2. Provide specific verbatim quotes from the conversation
3. Suggest concrete improvements where needed
4. Highlight particularly effective moments with exact quotes

Format your feedback clearly with specific verbatim quotes and actionable suggestions for improvement."""

def get_patient_response(user_input, conversation_history):
    """Get response from the LLM patient using Ollama."""
    # Prepare the full conversation context
    messages = [
        {"role": "system", "content": PATIENT_PROMPT},
        *conversation_history,
        {"role": "user", "content": user_input}
    ]
    
    # Use Ollama to generate response
    response = ollama.chat(
        model='llama2',  # You can change this to any model you have installed in Ollama
        messages=messages,
        stream=False
    )
    
    return response['message']['content']

def get_epa_feedback(transcript):
    """Get EPA-based feedback on the consultation using Ollama."""
    messages = [
        {"role": "system", "content": EPA_FEEDBACK_PROMPT},
        {"role": "user", "content": transcript}
    ]
    
    response = ollama.chat(
        model='llama2',  # You can change this to any model you have installed in Ollama
        messages=messages,
        stream=False
    )
    
    return response['message']['content']

def speak(text):
    """Convert text to speech using macOS's say command."""
    subprocess.run(['say', text])

def main():
    conversation_history = []
    full_transcript = []
    
    print("\n🩺 Starting medical consultation simulation...")
    print("🩺 You are Dr. Alex, a medical student. Speak clearly and naturally.")
    print("🩺 Type 'stop' to end the session and get feedback.")
    
    # Initial greeting
    # print("\n🩺 Dr. Alex: Hi, Mr. Johnson, my name is Alex, and I'm a medical student working with Dr. Smith, my attending, today. I'll be asking you some questions to understand what's going on, and then we'll come up with a plan together. Does that sound alright?")
    speak("Hi, Mr. Johnson, my name is Alex, and I'm a medical student working with Dr. Smith, my attending, today. I'll be asking you some questions to understand what's going on, and then we'll come up with a plan together. Does that sound alright?")
    
    while True:
        # Get user input
        user_input = listen()
        if user_input is None:
            print("🩺 Let's try again...")
            continue
            
        if any(cmd in user_input.lower() for cmd in ['quit', 'exit', 'end', 'stop']):
            print("\n🩺 Ending consultation...")
            break
            
        full_transcript.append(f"🩺 Dr. Alex: {user_input}")
        print(f"\n🩺 Dr. Alex: {user_input}")
        
        # Get patient response
        print("\n😷 Waiting for patient to reply...")
        patient_response = get_patient_response(user_input, conversation_history)
        print(f"\n😷 Mr. Johnson: {patient_response}")
        speak(patient_response)
        
        full_transcript.append(f"😷 Mr. Johnson: {patient_response}")
        
        # Update conversation history
        conversation_history.extend([
            {"role": "user", "content": user_input},
            {"role": "assistant", "content": patient_response}
        ])
    
    # Get EPA feedback
    if full_transcript:
        transcript_text = "\n".join(full_transcript)
        try:
            feedback = get_epa_feedback(transcript_text)
            print("\n📝 === EPA Feedback ===")
            print(feedback)
            
            # Save transcript and feedback
            with open("consultation_transcript.txt", "w") as f:
                f.write(transcript_text)
                f.write("\n\n=== EPA Feedback ===\n")
                f.write(feedback)
        except Exception as e:
            print(f"\n❌ Error getting feedback: {str(e)}")
            print("💾 Saving transcript without feedback...")
            with open("consultation_transcript.txt", "w") as f:
                f.write(transcript_text)
    else:
        print("❌ No conversation recorded. Ending session without feedback.")

if __name__ == "__main__":
    main() 