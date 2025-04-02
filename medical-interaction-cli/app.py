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
import requests

# Load environment variables
load_dotenv()

# API keys
ELEVEN_API_KEY = os.getenv("ELEVEN_API_KEY")
HUGGINGFACE_API_KEY = os.getenv("HUGGINGFACE_API_KEY")

# Model settings
USE_HUGGINGFACE = HUGGINGFACE_API_KEY is not None
MODEL_PROVIDER = "huggingface" if USE_HUGGINGFACE else "ollama"
HUGGINGFACE_MODEL = "meta-llama/Llama-2-7b-chat-hf"  # You can change this to any model you prefer
OLLAMA_MODEL = "llama2"  # Default Ollama model

# Print configuration
if ELEVEN_API_KEY:
    print("ElevenLabs API key loaded successfully")
else:
    print("ElevenLabs API key not found in .env file")

if USE_HUGGINGFACE:
    print(f"Using Hugging Face API with model: {HUGGINGFACE_MODEL}")
else:
    print(f"Using Ollama with model: {OLLAMA_MODEL}")

def speak(text):
    """Convert text to speech using ElevenLabs API only."""
    try:
        print(f"\nSpeaking: {text}")
        
        if not ELEVEN_API_KEY:
            print("ERROR: ElevenLabs API key is required but not found in .env file")
            return
            
        # Use ElevenLabs API directly via requests
        try:
            # Use Josh voice (male voice)
            voice_id = "TxGEqnHWrfWFTfGW9XjX"  # Josh voice ID
            
            url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
            
            headers = {
                "Accept": "audio/mpeg",
                "Content-Type": "application/json",
                "xi-api-key": ELEVEN_API_KEY
            }
            
            data = {
                "text": text,
                "model_id": "eleven_monolingual_v1",
                "voice_settings": {
                    "stability": 0.5,
                    "similarity_boost": 0.5
                }
            }
            
            print("Sending request to ElevenLabs...")
            response = requests.post(url, json=data, headers=headers)
            
            if response.status_code == 200:
                print(f"Received audio response: {len(response.content)} bytes")
                # Save audio to a temporary file and play it
                audio_file = "temp_speech.mp3"
                with open(audio_file, "wb") as f:
                    f.write(response.content)
                
                print(f"Saved audio to {audio_file}, playing now with afplay...")
                
                # Play using afplay (macOS built-in player)
                # Use full path to afplay and run in a subprocess
                try:
                    volume_command = ["osascript", "-e", "set volume output volume 100"]
                    subprocess.run(volume_command, check=True)
                    print("Volume set to maximum")
                    
                    afplay_result = subprocess.run(["/usr/bin/afplay", audio_file], 
                                                 check=True, 
                                                 stdout=subprocess.PIPE, 
                                                 stderr=subprocess.PIPE)
                    print(f"afplay completed with exit code: {afplay_result.returncode}")
                except subprocess.CalledProcessError as e:
                    print(f"Error playing audio: {e}")
                    print(f"Return code: {e.returncode}")
                    print(f"Output: {e.output}")
                    print(f"Stderr: {e.stderr}")
                finally:
                    # Clean up temp file
                    if os.path.exists(audio_file):
                        os.remove(audio_file)
                
                print("Speech completed (ElevenLabs)")
            else:
                print(f"ElevenLabs API error: {response.status_code}")
                print(f"Error details: {response.text}")
        except Exception as e:
            print(f"Error with ElevenLabs speech: {e}")
    except Exception as e:
        print(f"Error with speech: {e}")

def create_recognizer():
    """Create a new speech recognizer instance with optimized settings."""
    r = sr.Recognizer()
    r.energy_threshold = 300  # Increased for better detection
    r.dynamic_energy_threshold = True
    r.pause_threshold = 1.0  # Increased to allow for more natural pauses
    r.phrase_threshold = 0.5  # Increased for better phrase detection
    r.non_speaking_duration = 0.8  # Increased to not cut off speech too early
    return r

def listen():
    """Listen for user input with fallback to keyboard input."""
    # Ask user if they want to use speech or keyboard
    choice = input("\nUse speech recognition? (y/n): ")
    
    if choice.lower() in ['n', 'no']:
        # Use keyboard input
        text = input("Type your question (or 'stop' to end): ")
        return text
    
    # Try speech recognition
    try:
        # Create a new recognizer for each listen attempt
        recognizer = create_recognizer()
        
        # List microphones to help with debugging
        print("\nAvailable microphones:")
        mics = sr.Microphone.list_microphone_names()
        for i, name in enumerate(mics):
            print(f"{i}: {name}")
        
        # Use default microphone to avoid device index issues
        print("\nUsing default microphone...")
        with sr.Microphone() as mic:
            print("Adjusting for ambient noise...")
            recognizer.adjust_for_ambient_noise(mic, duration=2)  # Longer adjustment
            print("Ready! Speak clearly into the microphone...")
            
            try:
                # Get the audio with longer timeouts
                print("Listening for speech (speak clearly and a bit louder than normal)...")
                audio = recognizer.listen(mic, timeout=10, phrase_time_limit=15)  # Longer timeouts
                print("Audio captured! Processing...")
                
                try:
                    # Use Google's speech recognition
                    text = recognizer.recognize_google(audio)
                    if text:
                        print(f"\nYou said: {text}")
                        return text
                    else:
                        print("Received empty text from speech recognition.")
                except sr.UnknownValueError:
                    print("Sorry, I couldn't understand that.")
                except sr.RequestError as e:
                    print(f"Could not request results; {e}")
                    print("Please check your internet connection.")
            except sr.WaitTimeoutError:
                print("No speech detected.")
            except Exception as e:
                print(f"\nError capturing audio: {str(e)}")
    except Exception as e:
        print(f"Error initializing microphone: {str(e)}")
    
    # If speech recognition fails, fall back to keyboard input
    print("Falling back to keyboard input.")
    text = input("Type your question (or 'stop' to end): ")
    return text

# Patient persona prompt
PATIENT_PROMPT = """You are taking on the role of Mr. Johnson, a 35-year-old patient seeking medical care for a sore throat and related symptoms. Your goal is to interact naturally and realistically, using casual, everyday language like a normal adult would.

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
- No current medications

Example of good responses:
- Yeah, that sounds fine.
- I've had a sore throat for about two days now.
- It feels scratchy and burns when I swallowed.
- I've been taking Tylenol and ibuprofen, but they only help a little.
- I had a fever of 101.3 this morning.

Example of bad responses:
- *clears throat* So, yeah, I've had this sore throat...
- *glances around nervously* And this morning...
- *chuckles awkwardly* I've been taking those Tylenol...
- *shudders* The pain is getting worse...
- "Oh, it's really painful!"
- 😷 The pain is terrible!
- *winces in pain* It hurts a lot.
- Have you tried any other medications?
- What do you think is wrong with me?

Remember: Your responses should be simple, direct statements without any roleplay notation, actions, or special characters."""

# EPA feedback prompt
EPA_FEEDBACK_PROMPT = """Analyze the following medical consultation transcript and provide detailed, actionable feedback based on the Interpersonal Skills Checklist. For each component, identify specific examples from the conversation and rate them as Poor, Fair, Adequate, Very Good, or Excellent.

IMPORTANT: When referencing specific examples, you MUST include the exact verbatim quote from the transcript in quotation marks, followed by the speaker's name (e.g., "Dr. Alex: [exact quote]" or "Mr. Johnson: [exact quote]").

For each component, provide feedback in this exact structure:

1. Rating: [Poor/Fair/Adequate/Very Good/Excellent]
2. Strengths:
   - List 2-3 specific strengths with verbatim quotes
   - Explain why each strength is effective
3. Areas for Improvement:
   - List 2-3 specific areas with verbatim quotes
   - For each area, provide:
     a) What was observed: [verbatim quote]
     b) Why it needs improvement: [brief explanation]
     c) How to improve it: [specific, actionable suggestion]
4. Practice Tips:
   - 2-3 specific, practical tips the student can implement immediately

Components to evaluate:

1. Introduction
- Did the student introduce themselves properly?
- Did they identify the patient by name?
- Was the greeting warm and engaging?
- Did they set appropriate expectations for the consultation?

2. Questioning Skills
- Use of open-ended questions
- Frequency of interruptions
- Flow and organization of questioning
- Transition between topics
- Follow-up questions

3. Elicit Patient Perspective
- How well did they understand the patient's explanatory model?
- Did they explore the impact of illness on the patient's well-being?
- How well did they incorporate the patient's viewpoint?
- Did they acknowledge patient concerns?

4. Verbal Communication
- Use of medical jargon
- Organization of thoughts
- Tone of speech
- Clarity of explanations
- Pace of speech

5. Non-verbal Communication
- Eye contact
- Physical distance and expressions
- Overall attentiveness
- Body language
- Professional demeanor

6. Empathy
- Response to emotional cues
- Quality of empathetic responses
- Handling of pain or anxiety
- Recognition of patient emotions
- Validation of patient concerns

7. Respect
- Attitude towards the patient
- Partnership establishment
- Sensitivity during examination
- Cultural competence
- Professional boundaries

8. Closure
- Explanation of impression and plan
- Inquiry about remaining questions
- Closing remarks
- Follow-up arrangements
- Patient understanding check

At the end of your feedback, provide:
1. Overall Rating: [Poor/Fair/Adequate/Very Good/Excellent]
2. Key Strengths: Top 3 strengths with verbatim quotes
3. Priority Areas: Top 3 areas needing immediate improvement
4. Action Plan: 3 specific, actionable steps the student should take before their next consultation
5. Resources: 2-3 specific resources (articles, videos, or techniques) the student can use to improve

Format your feedback clearly with specific verbatim quotes and actionable suggestions for improvement. Focus on practical, implementable advice that the student can use immediately."""

def get_patient_response(user_input, conversation_history):
    """Get response from the LLM patient using either Ollama or Hugging Face."""
    # Prepare the full conversation context
    if USE_HUGGINGFACE:
        return get_huggingface_response(user_input, conversation_history)
    else:
        return get_ollama_response(user_input, conversation_history)

def get_ollama_response(user_input, conversation_history):
    """Get response using Ollama."""
    messages = [
        {"role": "system", "content": PATIENT_PROMPT},
        *conversation_history,
        {"role": "user", "content": user_input}
    ]
    
    # Use Ollama to generate response
    response = ollama.chat(
        model=OLLAMA_MODEL,
        messages=messages,
        stream=False
    )
    
    return response['message']['content']

def get_huggingface_response(user_input, conversation_history):
    """Get response using Hugging Face API."""
    messages = [
        {"role": "system", "content": PATIENT_PROMPT},
        *conversation_history,
        {"role": "user", "content": user_input}
    ]
    
    # Convert conversation to the format expected by the Hugging Face API
    prompt = ""
    for msg in messages:
        role = msg["role"]
        content = msg["content"]
        if role == "system":
            prompt += f"<s>[INST] <<SYS>>\n{content}\n<</SYS>>\n\n"
        elif role == "user":
            if prompt.endswith("[/INST]"):
                prompt += f"<s>[INST] {content} [/INST]"
            else:
                prompt += f"{content} [/INST]"
        elif role == "assistant":
            prompt += f" {content} </s>"
    
    # If the prompt doesn't end with [/INST], add it
    if not prompt.endswith("[/INST]"):
        prompt += " [/INST]"
    
    # API endpoint
    API_URL = f"https://api-inference.huggingface.co/models/{HUGGINGFACE_MODEL}"
    
    # Headers
    headers = {
        "Authorization": f"Bearer {HUGGINGFACE_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Payload
    payload = {
        "inputs": prompt,
        "parameters": {
            "max_new_tokens": 100,
            "temperature": 0.7,
            "top_p": 0.9,
            "do_sample": True
        }
    }
    
    # Make the request
    try:
        response = requests.post(API_URL, headers=headers, json=payload)
        response.raise_for_status()  # Raise an exception for HTTP errors
        
        # Parse the response
        result = response.json()
        
        # Extract the generated text
        if isinstance(result, list) and len(result) > 0:
            generated_text = result[0].get("generated_text", "")
            
            # Extract the assistant's response after the last [/INST] tag
            if "[/INST]" in generated_text:
                assistant_response = generated_text.split("[/INST]")[-1].strip()
                # Remove any remaining tags like </s>
                assistant_response = assistant_response.replace("</s>", "").strip()
                return assistant_response
            else:
                return generated_text
        else:
            return "I'm sorry, I couldn't generate a response. Please try again."
    
    except Exception as e:
        print(f"Error calling Hugging Face API: {str(e)}")
        return "I'm sorry, there was an error generating a response. Please try again."

def get_epa_feedback(transcript):
    """Get EPA-based feedback on the consultation using either Ollama or Hugging Face."""
    if USE_HUGGINGFACE:
        return get_huggingface_feedback(transcript)
    else:
        return get_ollama_feedback(transcript)

def get_ollama_feedback(transcript):
    """Get feedback using Ollama."""
    messages = [
        {"role": "system", "content": EPA_FEEDBACK_PROMPT},
        {"role": "user", "content": transcript}
    ]
    
    response = ollama.chat(
        model=OLLAMA_MODEL,
        messages=messages,
        stream=False
    )
    
    return response['message']['content']

def get_huggingface_feedback(transcript):
    """Get feedback using Hugging Face API."""
    prompt = f"<s>[INST] <<SYS>>\n{EPA_FEEDBACK_PROMPT}\n<</SYS>>\n\n{transcript} [/INST]"
    
    # API endpoint
    API_URL = f"https://api-inference.huggingface.co/models/{HUGGINGFACE_MODEL}"
    
    # Headers
    headers = {
        "Authorization": f"Bearer {HUGGINGFACE_API_KEY}",
        "Content-Type": "application/json"
    }
    
    # Payload
    payload = {
        "inputs": prompt,
        "parameters": {
            "max_new_tokens": 500,
            "temperature": 0.7,
            "top_p": 0.9,
            "do_sample": True
        }
    }
    
    # Make the request
    try:
        response = requests.post(API_URL, headers=headers, json=payload)
        response.raise_for_status()  # Raise an exception for HTTP errors
        
        # Parse the response
        result = response.json()
        
        # Extract the generated text
        if isinstance(result, list) and len(result) > 0:
            generated_text = result[0].get("generated_text", "")
            
            # Extract the assistant's response after the last [/INST] tag
            if "[/INST]" in generated_text:
                assistant_response = generated_text.split("[/INST]")[-1].strip()
                # Remove any remaining tags like </s>
                assistant_response = assistant_response.replace("</s>", "").strip()
                return assistant_response
            else:
                return generated_text
        else:
            return "I'm sorry, I couldn't generate feedback. Please try again."
    
    except Exception as e:
        print(f"Error calling Hugging Face API: {str(e)}")
        return "I'm sorry, there was an error generating feedback. Please try again."

def main():
    conversation_history = []
    full_transcript = []
    
    print("\n🩺 Starting medical consultation simulation...")
    print("🩺 You are Dr. Alex, a medical student. Speak clearly and naturally.")
    print("🩺 Type 'stop' to end the session and get feedback.")
    
    # Initial greeting (printed only, not spoken)
    print("\n🩺 Dr. Alex: Hi, Mr. Johnson, my name is Alex, and I'm a medical student working with Dr. Smith, my attending, today. I'll be asking you some questions to understand what's going on, and then we'll come up with a plan together. Does that sound alright?")
    
    while True:
        try:
            # Get user input
            user_input = listen()
            if user_input is None:
                print("🩺 Let's try again...")
                time.sleep(1)
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
            
            # Make the patient speak their response
            speak(patient_response)
            
            full_transcript.append(f"😷 Mr. Johnson: {patient_response}")
            
            # Update conversation history
            conversation_history.extend([
                {"role": "user", "content": user_input},
                {"role": "assistant", "content": patient_response}
            ])
            
            # Add a small delay between interactions
            time.sleep(0.5)
            
        except KeyboardInterrupt:
            print("\n🩺 Ending consultation...")
            break
        except Exception as e:
            print(f"\n❌ Error during conversation: {str(e)}")
            print("🩺 Let's try again...")
            time.sleep(1)
            continue
    
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