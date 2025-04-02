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
PATIENT_PROMPT = """You are a patient in a medical consultation. You should:
1. Respond naturally and conversationally
2. Provide relevant medical history when asked
3. Express concerns and symptoms clearly
4. Ask questions when appropriate
5. Maintain a realistic patient demeanor

Current symptoms: Mild headache, occasional dizziness, and fatigue for the past 3 days.
Medical history: No significant medical history, occasional seasonal allergies.
Current medications: None."""

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
            
        if user_input.lower() in ['quit', 'exit', 'end', 'stop']:
            print("\nEnding consultation...")
            break
            
        full_transcript.append(f"Doctor: {user_input}")
        
        # Get patient response
        patient_response = get_patient_response(user_input, conversation_history)
        print(f"\nPatient: {patient_response}")
        speak(patient_response)
        
        full_transcript.append(f"Patient: {patient_response}")
        
        # Update conversation history
        conversation_history.extend([
            {"role": "user", "content": user_input},
            {"role": "assistant", "content": patient_response}
        ])
    
    # Get EPA feedback
    if full_transcript:
        transcript_text = "\n".join(full_transcript)
        feedback = get_epa_feedback(transcript_text)
        
        print("\n=== EPA Feedback ===")
        print(feedback)
        
        # Save transcript and feedback
        with open("consultation_transcript.txt", "w") as f:
            f.write(transcript_text)
            f.write("\n\n=== EPA Feedback ===\n")
            f.write(feedback)
    else:
        print("No conversation recorded. Ending session without feedback.")

if __name__ == "__main__":
    main() 