"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

// Debug helper function that logs with timestamps
const debugLog = (message: string, data?: any) => {
  const timestamp = new Date().toISOString().substring(11, 23); // HH:MM:SS.mmm format
  console.log(`[${timestamp}] ${message}`, data !== undefined ? data : '');
};

export default function Simulator() {
  debugLog('Simulator component initializing');
  
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "patient"; content: string }[]>([
    { role: "patient", content: "Hello, I'm Mr. Johnson. I've been having a sore throat for the past couple of days." }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [apiErrors, setApiErrors] = useState<string[]>([]);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Speech recognition setup
  const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const recognition = useRef<any>(null);

  useEffect(() => {
    debugLog('Simulator component mounted');
    
    // Create audio element for ElevenLabs TTS
    if (typeof window !== 'undefined' && !audioRef.current) {
      audioRef.current = new Audio();
      
      // Add event listeners
      audioRef.current.addEventListener('play', () => {
        debugLog('Audio started playing');
        setIsSpeaking(true);
      });
      
      audioRef.current.addEventListener('ended', () => {
        debugLog('Audio finished playing');
        setIsSpeaking(false);
      });
      
      audioRef.current.addEventListener('error', (e) => {
        debugLog('Audio playback error', e);
        setIsSpeaking(false);
        setApiErrors(prev => [...prev, `Audio playback error: ${(e as any).message || 'Unknown error'}`]);
      });
    }
    
    return () => {
      // Clean up audio element
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
      debugLog('Simulator component unmounting');
    };
  }, []);

  useEffect(() => {
    if (SpeechRecognition) {
      debugLog('Setting up speech recognition');
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = true;
      recognition.current.interimResults = true;
      
      recognition.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result) => result.transcript)
          .join("");
          
        debugLog('Speech recognition result:', transcript);
        setInput(transcript);
      };

      recognition.current.onend = () => {
        debugLog('Speech recognition ended, isListening:', isListening);
        if (isListening) {
          debugLog('Restarting speech recognition');
          recognition.current.start();
        }
      };

      recognition.current.onerror = (event: any) => {
        debugLog('Speech recognition error:', event.error);
        setApiErrors(prev => [...prev, `Speech recognition error: ${event.error}`]);
      };
    } else {
      debugLog('Speech recognition not available in this browser');
    }
  }, [SpeechRecognition, isListening]);

  // Scroll to bottom of message list when new messages arrive
  useEffect(() => {
    debugLog('Messages updated, scrolling to bottom');
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Speak initial greeting when component loads
  useEffect(() => {
    // Speak the initial greeting after a short delay
    const initialGreeting = messages[0]?.content;
    if (initialGreeting) {
      const timer = setTimeout(() => {
        debugLog('Speaking initial greeting');
        speakWithElevenLabs(initialGreeting);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, []); // Only run once on component mount

  const toggleListening = () => {
    debugLog('Toggle listening:', !isListening);
    if (isListening) {
      recognition.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognition.current?.start();
        setIsListening(true);
      } catch (error) {
        debugLog('Error starting speech recognition:', error);
        setApiErrors(prev => [...prev, `Failed to start speech recognition: ${(error as Error).message}`]);
      }
    }
  };

  // Function to play text using ElevenLabs
  const speakWithElevenLabs = async (text: string) => {
    if (!text || isSpeaking) return;
    
    debugLog('Speaking with ElevenLabs:', text);
    
    try {
      const startTime = Date.now();
      
      // Call our speech API
      debugLog('Fetching audio from speech API...');
      const response = await fetch('/api/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text }),
      });
      
      const responseTime = Date.now() - startTime;
      debugLog(`Speech API response received in ${responseTime}ms, status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        debugLog('Error response body:', errorText);
        throw new Error(`Speech API error: ${response.status} ${errorText}`);
      }
      
      // Log response headers for debugging
      const headers = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      debugLog('Response headers:', headers);
      
      // Get the audio data as blob
      const audioBlob = await response.blob();
      debugLog('Audio blob received, size:', audioBlob.size, 'type:', audioBlob.type);
      
      if (audioBlob.size === 0) {
        throw new Error('Received empty audio blob from speech API');
      }
      
      // Create object URL for audio playback
      const audioUrl = URL.createObjectURL(audioBlob);
      debugLog('Created audio URL:', audioUrl);
      
      // Play the audio
      if (audioRef.current) {
        // Stop any currently playing audio
        audioRef.current.pause();
        
        // Set new source and play
        audioRef.current.src = audioUrl;
        
        // Add event listeners for debugging
        const onLoadedMetadata = () => {
          debugLog('Audio metadata loaded, duration:', audioRef.current?.duration);
        };
        
        const onCanPlay = () => {
          debugLog('Audio can play now');
        };
        
        audioRef.current.addEventListener('loadedmetadata', onLoadedMetadata);
        audioRef.current.addEventListener('canplay', onCanPlay);
        
        try {
          debugLog('Attempting to play audio...');
          const playPromise = audioRef.current.play();
          
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                debugLog('Audio playback started successfully');
              })
              .catch(error => {
                debugLog('Error playing audio:', error);
                setIsSpeaking(false);
                setApiErrors(prev => [...prev, `Audio playback failed: ${error.message}`]);
              })
              .finally(() => {
                // Remove event listeners
                audioRef.current?.removeEventListener('loadedmetadata', onLoadedMetadata);
                audioRef.current?.removeEventListener('canplay', onCanPlay);
              });
          }
        } catch (playError) {
          debugLog('Exception while playing audio:', playError);
          setIsSpeaking(false);
          setApiErrors(prev => [...prev, `Audio playback exception: ${(playError as Error).message}`]);
        }
      } else {
        debugLog('Audio element reference is not available');
        setApiErrors(prev => [...prev, 'Audio element reference is not available']);
      }
    } catch (error) {
      debugLog('Error in ElevenLabs speech:', error);
      setIsSpeaking(false);
      setApiErrors(prev => [...prev, `ElevenLabs error: ${(error as Error).message}`]);
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMessage = input.trim();
    debugLog('Sending message:', userMessage);
    
    // Stop listening if active
    if (isListening) {
      debugLog('Stopping speech recognition before sending message');
      recognition.current?.stop();
      setIsListening(false);
    }
    
    // Stop any current speech
    if (isSpeaking && audioRef.current) {
      debugLog('Stopping current speech before sending new message');
      audioRef.current.pause();
      setIsSpeaking(false);
    }

    setInput("");
    
    // Add user message to chat
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    
    // Check if user wants to end session
    if (userMessage.toUpperCase() === "STOP") {
      debugLog('Session end requested, getting feedback');
      setIsLoading(true);
      try {
        const startTime = Date.now();
        // Get feedback from API
        debugLog('Calling feedback API');
        const response = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages })
        });
        
        const responseTime = Date.now() - startTime;
        debugLog(`Feedback API response received in ${responseTime}ms, status: ${response.status}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Failed to get feedback: ${response.status} ${errorText}`);
        }
        
        const data = await response.json();
        debugLog('Feedback received, length:', data.feedback?.length);
        setFeedback(data.feedback);
        setSessionEnded(true);
      } catch (error) {
        debugLog('Error getting feedback:', error);
        setApiErrors(prev => [...prev, `Feedback error: ${(error as Error).message}`]);
      } finally {
        setIsLoading(false);
      }
      return;
    }
    
    // Get response from API
    setIsLoading(true);
    try {
      const startTime = Date.now();
      debugLog('Calling patient API');
      const response = await fetch("/api/patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: userMessage, 
          history: messages 
        })
      });
      
      const responseTime = Date.now() - startTime;
      debugLog(`Patient API response received in ${responseTime}ms, status: ${response.status}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get patient response: ${response.status} ${errorText}`);
      }
      
      const data = await response.json();
      debugLog('Patient response:', data.response);
      
      // Add patient response to chat
      setMessages((prev) => [...prev, { role: "patient", content: data.response }]);
      
      // Speak the response using ElevenLabs
      speakWithElevenLabs(data.response);
      
    } catch (error) {
      debugLog('Error getting patient response:', error);
      setApiErrors(prev => [...prev, `Patient API error: ${(error as Error).message}`]);
      
      // Add error message to chat
      setMessages((prev) => [...prev, { 
        role: "patient", 
        content: "I'm sorry, I'm having trouble responding right now. Please try again." 
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage();
  };

  if (sessionEnded) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="bg-blue-700 text-white p-6">
          <h1 className="text-3xl font-bold">Simulation Complete</h1>
        </header>
        
        <main className="flex-grow p-6 max-w-4xl mx-auto w-full">
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4">Feedback on Your Interaction</h2>
            <div className="whitespace-pre-line bg-gray-50 p-4 rounded">
              {feedback ? feedback : "Feedback is being generated..."}
            </div>
          </div>
          
          <div className="bg-white shadow-md rounded-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Conversation Transcript</h2>
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <div key={index} className={`p-3 rounded-lg ${msg.role === "user" ? "bg-blue-100" : "bg-gray-100"}`}>
                  <p className="font-semibold">{msg.role === "user" ? "Doctor" : "Mr. Johnson"}</p>
                  <p>{msg.content}</p>
                </div>
              ))}
            </div>
          </div>
          
          <div className="mt-6 text-center">
            <Link 
              href="/simulator"
              className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md transition-colors"
            >
              Start New Simulation
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-blue-700 text-white p-6">
        <h1 className="text-3xl font-bold">Medical Consultation Simulator</h1>
        <p className="mt-2">Interact with Mr. Johnson, who has a sore throat</p>
      </header>
      
      <main className="flex-grow p-4 md:p-6 max-w-4xl mx-auto w-full flex flex-col">
        {apiErrors.length > 0 && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            <h3 className="font-bold">Debug Info:</h3>
            <ul className="list-disc pl-5 text-sm">
              {apiErrors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}
        
        <div className="bg-white shadow-md rounded-lg flex-grow overflow-hidden flex flex-col">
          {/* Message display area */}
          <div className="flex-grow overflow-y-auto p-4">
            <div className="space-y-4">
              {messages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`p-3 rounded-lg ${msg.role === "user" ? "bg-blue-100 ml-auto max-w-[80%]" : "bg-gray-100 mr-auto max-w-[80%]"}`}
                >
                  <p className="font-semibold">{msg.role === "user" ? "You" : "Mr. Johnson"}</p>
                  <p>{msg.content}</p>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
          
          {/* Input area */}
          <form onSubmit={handleSubmit} className="border-t p-4 flex gap-2">
            <button 
              type="button"
              onClick={toggleListening}
              className={`${isListening ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"} text-white rounded-full p-2 flex-shrink-0`}
              title={isListening ? "Stop listening" : "Start listening"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message or press the mic button to speak..."
              className="flex-grow border rounded-md px-3 py-2"
              disabled={isLoading}
            />
            <button 
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md disabled:opacity-50"
              disabled={isLoading || !input.trim()}
            >
              {isLoading ? "..." : "Send"}
            </button>
          </form>
        </div>
        
        <div className="mt-4 text-sm text-gray-600">
          <p>Type "STOP" to end the consultation and receive feedback.</p>
        </div>
      </main>
    </div>
  );
} 