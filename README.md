# Medical Interaction Simulator

A speech-to-speech interaction system that simulates a medical consultation with an AI patient and provides EPA-based feedback using local LLMs via Ollama.

## Features

- Real-time speech-to-text and text-to-speech interaction
- AI-powered patient simulation using local LLMs
- EPA (Entrustable Professional Activities) based feedback
- Conversation transcript saving
- Natural language processing for medical consultations

## Prerequisites

- Python 3.8 or higher
- Ollama installed and running locally
- Microphone
- Speakers

## Installation

1. Install Ollama:
   - Visit [Ollama's official website](https://ollama.ai/) and follow the installation instructions for your platform
   - After installation, pull the desired model (e.g., llama2):
     ```bash
     ollama pull llama2
     ```

2. Clone this repository

3. Install the required Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Usage

1. Make sure Ollama is running on your system

2. Run the application:
   ```bash
   python app.py
   ```

3. Speak to the AI patient when prompted

4. The conversation will be saved in `consultation_transcript.txt`

5. To end the session, say "quit", "exit", "end", or "stop"

## Customization

You can modify the following in `app.py`:
- Change the model by modifying the `model` parameter in `get_patient_response` and `get_epa_feedback` functions
- Adjust the patient's characteristics by modifying the `PATIENT_PROMPT`
- Customize the EPA feedback criteria in `EPA_FEEDBACK_PROMPT`

## EPA Feedback Areas

The feedback system evaluates:
- Communication skills
- History taking
- Clinical reasoning
- Patient-centered care
- Professionalism

## Notes

- Make sure your microphone is properly configured
- Speak clearly and at a moderate pace
- The system uses Google's speech recognition service
- All conversations are saved locally for review
- You can use any model available in Ollama by changing the model name in the code 