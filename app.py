import os
import speech_recognition as sr
import ollama
from dotenv import load_dotenv
import json
import time
import subprocess
import threading
import queue
import wave
import pyaudio

# Load environment variables
load_dotenv()

# Initialize speech recognizer with better settings
recognizer = sr.Recognizer()
recognizer.energy_threshold = 4000  # Adjust based on your environment
recognizer.dynamic_energy_threshold = True
recognizer.pause_threshold = 0.8  # Shorter pause threshold for more responsive interaction

# Create a queue for keyboard input
input_queue = queue.Queue()

# Initialize microphone
try:
    microphone = sr.Microphone()
    with microphone as source:
        print("Calibrating microphone for ambient noise...")
        recognizer.adjust_for_ambient_noise(source, duration=2)
        print("Microphone calibration complete.")
except Exception as e:
    print(f"Error initializing microphone: {e}")
    microphone = None

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

def keyboard_input_thread():
    """Thread function to handle keyboard input."""
    while True:
        try:
            print("Type your input (or press Enter to skip):")
            text = input()
            print(f"Keyboard thread received: {text}")
            input_queue.put(text)
            if text.upper() == "STOP":
                break
        except EOFError:
            print("EOFError in keyboard input thread")
            break
        except Exception as e:
            print(f"Error in keyboard thread: {e}")
            break

def listen():
    """Listen for user input (both speech and keyboard)."""
    try:
        # Get direct keyboard input first
        print("\nEnter your response (or press Enter to use voice input):")
        text = input().strip()
        if text:
            print(f"You typed: {text}")
            return text
            
        # If no keyboard input, try voice
        if microphone is None:
            print("Microphone not available. Please use keyboard input.")
            return None
            
        print("\nListening for voice input... (speak now)")
        with microphone as source:
            try:
                audio = recognizer.listen(source, timeout=10, phrase_time_limit=15)
                print("Processing speech...")
                text = recognizer.recognize_google(audio, language="en-US")
                print(f"You said: {text}")
                return text
            except sr.WaitTimeoutError:
                print("No voice input detected within 10 seconds. Please try again.")
                return None
            except sr.UnknownValueError:
                print("Voice was not understood. Please try again.")
                return None
            except sr.RequestError as e:
                print(f"Could not request results from speech recognition service; {e}")
                return None
    except Exception as e:
        print(f"Error during input: {e}")
        return None

def main():
    conversation_history = []
    full_transcript = []
    
    print("Starting medical consultation simulation...")
    print("You can speak or type your responses. Type 'STOP' to end the session and get feedback.")
    
    # Test microphone before starting
    if microphone is None:
        print("Warning: Microphone is not available. Voice input will not work.")
        print("Please check your microphone connection and permissions.")
    
    speak("Hello, I'm your patient today. How can I help you?")
    
    while True:
        # Get user input
        user_input = listen()
        if user_input is None:
            continue
            
        if user_input.upper() == "STOP":
            print("\nEnding consultation...")
            break
            
        full_transcript.append(f"Doctor: {user_input}")
        
        # Get patient response
        patient_response = get_patient_response(user_input, conversation_history)
        print(f"Patient: {patient_response}")
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