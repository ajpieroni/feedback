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
                    print(f"\nYou said: {text}")
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
PATIENT_PROMPT = """You are taking on the role of a 35-year-old patient seeking medical care for a sore throat and related symptoms. Your goal is to interact naturally and realistically, using casual, everyday language like a normal adult would.

Guidelines for Your Role:
• Speak naturally – Use simple, conversational language to describe your symptoms. Avoid complex medical terms, as you aren't a doctor and wouldn't naturally use them.
• Stick to what you know – You only know how you feel. Even if you've heard of strep throat before, don't diagnose yourself or lead the doctor.
• Be realistic – Don't immediately list all your symptoms. Wait for the doctor to ask questions before revealing more details.
• Express how you feel – If something hurts, be clear about it. If you're frustrated, show it. If you're worried about missing work, mention it. Keep it authentic and human.
• Stay truthful – Your symptoms should match the details provided below. Do not add, exaggerate, or change anything.

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
1. Respond naturally and conversationally
2. Only reveal symptoms when asked
3. Express your concerns about work and family
4. Use everyday language, not medical terms
5. Stay consistent with the symptoms described above"""

# EPA feedback prompt
EPA_FEEDBACK_PROMPT = """Analyze the following medical consultation transcript and provide feedback based on EPA (Entrustable Professional Activities) guidelines. Focus on:
1. Communication skills
2. History taking
3. Clinical reasoning
4. Patient-centered care
5. Professionalism

Provide specific examples and suggestions for improvement."""

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
    
    print("Starting medical consultation simulation...")
    print("You can speak to the patient. Speak clearly and naturally.")
    print("Type 'stop' to end the session and get feedback.")
    speak("Hello, I'm your patient today. How can I help you?")
    
    while True:
        # Get user input
        user_input = listen()
        if user_input is None:
            print("Let's try again...")
            continue
            
        # Check for stop commands first
        if any(cmd in user_input.lower() for cmd in ['quit', 'exit', 'end', 'stop']):
            print("\nEnding consultation...")
            break
            
        full_transcript.append(f"Doctor: {user_input}")
        
        # Get patient response
        print("\nWaiting for patient to reply...")
        try:
            patient_response = get_patient_response(user_input, conversation_history)
            print(f"\nPatient: {patient_response}")
            speak(patient_response)
            
            full_transcript.append(f"Patient: {patient_response}")
            
            # Update conversation history
            conversation_history.extend([
                {"role": "user", "content": user_input},
                {"role": "assistant", "content": patient_response}
            ])
        except Exception as e:
            print(f"\nError getting patient response: {str(e)}")
            print("Ending consultation due to error...")
            break
    
    # Get EPA feedback
    if full_transcript:
        transcript_text = "\n".join(full_transcript)
        try:
            feedback = get_epa_feedback(transcript_text)
            print("\n=== EPA Feedback ===")
            print(feedback)
            
            # Save transcript and feedback
            with open("consultation_transcript.txt", "w") as f:
                f.write(transcript_text)
                f.write("\n\n=== EPA Feedback ===\n")
                f.write(feedback)
        except Exception as e:
            print(f"\nError getting feedback: {str(e)}")
            print("Saving transcript without feedback...")
            with open("consultation_transcript.txt", "w") as f:
                f.write(transcript_text)
    else:
        print("No conversation recorded. Ending session without feedback.")

if __name__ == "__main__":
    main() 