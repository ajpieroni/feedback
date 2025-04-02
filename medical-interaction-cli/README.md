# Medical Interaction Simulator

This repository contains two applications for medical interaction simulation:

## 1. CLI Application
Located in the `medical-interaction-cli` directory, this is a command-line interface application that simulates a medical consultation with a virtual patient using:
- Speech recognition for doctor input
- LLM for patient responses
- Text-to-speech for patient voice output

To use the CLI application:
1. Navigate to the `medical-interaction-cli` directory
2. Copy `.env.example` to `.env` and add your API keys
3. Install dependencies: `pip install -r requirements.txt`
4. Run the application: `python app.py`

## 2. Web Application
Located in the `medical-interaction-webapp` directory, this is a Next.js web application that provides a browser-based interface for the medical interaction simulator.

To use the web application:
1. Navigate to the `medical-interaction-webapp` directory
2. Copy `.env.example` to `.env.local` and add your API keys
3. Install dependencies: `npm install`
4. Run the application: `npm run dev`

## Setup
Both applications require API keys:
- ElevenLabs API key for text-to-speech
- HuggingFace API key for LLM access (optional, Ollama can be used instead)

Make sure to add your API keys to the appropriate `.env` files in each application directory.

## Note on API Keys
For security reasons, do not commit your actual API keys to the repository. The `.env` files are included in `.gitignore`.

## Features

- Real-time speech-to-text and text-to-speech interaction
- Support for both voice and keyboard input
- AI-powered patient simulation using local LLMs
- EPA (Entrustable Professional Activities) based feedback
- Conversation transcript saving
- Natural language processing for medical consultations

## Prerequisites

### System Requirements
- Python 3.8 or higher
- Ollama installed and running locally
- Microphone (for speech input)
- Speakers (for audio output)

### System Dependencies
On macOS:
```bash
# Install Homebrew if you haven't already
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install required system dependencies
brew install portaudio  # Required for PyAudio
brew install flac      # Required for speech recognition
```

On Linux (Ubuntu/Debian):
```bash
sudo apt-get update
sudo apt-get install portaudio19-dev python3-pyaudio flac
```

## Installation

1. Install Ollama:
   - Visit [Ollama's official website](https://ollama.ai/) and follow the installation instructions for your platform
   - After installation, pull the llama2 model:
     ```bash
     ollama pull llama2
     ```

2. Clone this repository:
   ```bash
   git clone <repository-url>
   cd medical-interaction-simulator
   ```

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

3. Interact with the patient:
   - You can either speak your responses (wait for "Listening...")
   - OR type your responses and press Enter
   - The patient will respond both verbally and in text

4. End the session:
   - Type "STOP" (in uppercase) to end the consultation
   - You will receive EPA-based feedback on your interaction
   - The conversation transcript and feedback will be saved in `consultation_transcript.txt`

## Customization

You can modify the following in `app.py`:
- Change the Ollama model by modifying the `model` parameter in `get_patient_response` and `get_epa_feedback` functions
- Adjust the patient's characteristics by modifying the `PATIENT_PROMPT`
- Customize the EPA feedback criteria in `EPA_FEEDBACK_PROMPT`

## EPA Feedback Areas

The feedback system evaluates:
- Communication skills
- History taking
- Clinical reasoning
- Patient-centered care
- Professionalism

## Troubleshooting

1. If you get a PyAudio error:
   - Make sure you have installed portaudio (see System Dependencies)
   - Try reinstalling PyAudio: `pip install --force-reinstall pyaudio`

2. If speech recognition isn't working:
   - Check if your microphone is properly configured in system settings
   - Ensure FLAC is installed (see System Dependencies)
   - Try using keyboard input as an alternative

3. If Ollama isn't responding:
   - Ensure Ollama is running (`ollama serve`)
   - Verify the llama2 model is installed (`ollama list`)
   - Check Ollama logs for any errors

## Notes

- The first response from the LLM might take a few seconds as it loads the model
- Speech recognition works best in a quiet environment
- Speak clearly and at a moderate pace for best results
- All conversations are saved locally for review
- You can use any model available in Ollama by changing the model name in the code 