import pyttsx3
import subprocess
import time

def test_pyttsx3():
    print("\nTesting pyttsx3...")
    try:
        engine = pyttsx3.init()
        print("Engine initialized successfully")
        
        # Test different properties
        print("\nAvailable voices:")
        voices = engine.getProperty('voices')
        for voice in voices:
            print(f"Voice: {voice.name}, ID: {voice.id}")
        
        print("\nCurrent properties:")
        print(f"Rate: {engine.getProperty('rate')}")
        print(f"Volume: {engine.getProperty('volume')}")
        
        # Try speaking
        print("\nAttempting to speak...")
        engine.say("This is a test of pyttsx3")
        engine.runAndWait()
        print("Speech completed")
    except Exception as e:
        print(f"Error with pyttsx3: {e}")

def test_say_command():
    print("\nTesting say command...")
    try:
        # Test basic say command
        print("Testing basic say command...")
        subprocess.run(['say', 'This is a test of the say command'])
        
        # Test with different voices
        print("\nTesting with different voices...")
        voices = ['Daniel', 'Fred', 'Ralph']
        for voice in voices:
            print(f"Testing voice: {voice}")
            subprocess.run(['say', '-v', voice, f'This is a test with voice {voice}'])
            time.sleep(1)  # Wait between voices
    except Exception as e:
        print(f"Error with say command: {e}")

def test_system_sound():
    print("\nTesting system sound...")
    try:
        # Try playing a system sound
        print("Playing system sound...")
        subprocess.run(['afplay', '/System/Library/Sounds/Glass.aiff'])
    except Exception as e:
        print(f"Error playing system sound: {e}")

if __name__ == "__main__":
    print("Starting speech synthesis tests...")
    
    # Test system sound first
    test_system_sound()
    time.sleep(1)
    
    # Test say command
    test_say_command()
    time.sleep(1)
    
    # Test pyttsx3
    test_pyttsx3()
    
    print("\nAll tests completed.") 