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

# Test microphone availability
def test_microphone():
    try:
        print("\nTesting microphone availability...")
        # List all available microphones
        print("\nAvailable microphones:")
        for index, name in enumerate(sr.Microphone.list_microphone_names()):
            print(f"Microphone {index}: {name}")
        
        # Try to initialize the microphone
        mic = sr.Microphone()
        print("\nMicrophone initialized successfully")
        return True
    except Exception as e:
        print(f"\nError testing microphone: {str(e)}")
        return False

# Initialize speech recognizer with optimized settings
recognizer = sr.Recognizer()
recognizer.energy_threshold = 300  # Lower threshold for better sensitivity
recognizer.dynamic_energy_threshold = True
recognizer.pause_threshold = 0.8  # Shorter pause threshold
recognizer.phrase_threshold = 0.3  # Lower phrase threshold
recognizer.non_speaking_duration = 0.5  # Shorter non-speaking duration

# Test microphone before proceeding
if not test_microphone():
    print("Warning: Microphone initialization failed. Please check your microphone connection and permissions.")
    exit(1)

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

def listen():
    """Listen for user input and convert to text."""
    try:
        with sr.Microphone() as source:
            print("\nListening... (speak now)")
            print("Adjusting for ambient noise...")
            recognizer.adjust_for_ambient_noise(source, duration=1)
            print("Ready! Speak clearly into the microphone...")
            
            # Capture audio with visual feedback
            audio = recognizer.listen(source, timeout=5)
            print("Audio captured! Processing...")
            
            # Save audio for debugging
            audio_data = io.BytesIO()
            with wave.open(audio_data, 'wb') as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(16000)
                wf.writeframes(audio.get_raw_data())
            
            try:
                # Try multiple recognition attempts with different settings
                text = recognizer.recognize_google(audio, language="en-US", show_all=True)
                
                if isinstance(text, dict) and 'alternative' in text:
                    # Get the most confident result
                    best_result = text['alternative'][0]
                    print(f"\nYou said: {best_result['transcript']}")
                    if len(text['alternative']) > 1:
                        print("\nOther possible interpretations:")
                        for alt in text['alternative'][1:]:
                            print(f"- {alt['transcript']}")
                    return best_result['transcript']
                else:
                    print("Sorry, I couldn't understand that clearly. Please try again.")
                    return None
                    
            except sr.UnknownValueError:
                print("Sorry, I couldn't understand that. Please speak more clearly.")
                return None
            except sr.RequestError as e:
                print(f"Could not request results; {e}")
                print("Please check your internet connection.")
                return None
    except Exception as e:
        print(f"Error during listening: {str(e)}")
        return None

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