"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from 'react-markdown';

// Debug helper function that logs with timestamps
const debugLog = (message: string, ...args: any[]) => {
  const timestamp = new Date().toISOString().substring(11, 23); // HH:MM:SS.mmm format
  console.log(`[${timestamp}] ${message}`, ...args);
};

export default function Simulator() {
  debugLog('Simulator component initializing');
  
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false); // Start with microphone off
  const [messages, setMessages] = useState<{ role: "user" | "patient"; content: string }[]>([
    { role: "patient", content: "Hello, nice to see you." }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [apiErrors, setApiErrors] = useState<string[]>([]);
  const [needsUserInteraction, setNeedsUserInteraction] = useState(true); // Track if we need user interaction
  const [initialGreetingPlayed, setInitialGreetingPlayed] = useState(false); // Track if greeting has been played
  const [micVolume, setMicVolume] = useState(0); // Track microphone volume level
  const [lastSpeechTimestamp, setLastSpeechTimestamp] = useState(0); // Track when speech was last detected
  const [autoSendTimer, setAutoSendTimer] = useState<NodeJS.Timeout | null>(null); // Timer for auto-sending
  const [autoSendCountdown, setAutoSendCountdown] = useState<number | null>(null); // Countdown for auto-send
  const [textOnlyMode, setTextOnlyMode] = useState(false); // Option to use text-only mode
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  
  // Speech recognition setup
  const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const recognition = useRef<any>(null);
  const isRecognitionActive = useRef(false);
  const recognitionStartAttempts = useRef(0);
  const maxRecognitionStartAttempts = 3;
  const isRecognitionInitialized = useRef(false);
  const isSendingMessage = useRef(false);

  // Add a ref to track if we're manually toggling
  const isManualToggle = useRef(false);

  // Speech recognition setup effect
  useEffect(() => {
    if (!SpeechRecognition) {
      debugLog('Speech recognition not available in this browser');
      return;
    }

    // Only initialize once
    if (isRecognitionInitialized.current) {
      debugLog('Speech recognition already initialized');
      return;
    }

    debugLog('Setting up speech recognition');
    
    try {
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = true;
      recognition.current.interimResults = true;
      
      recognition.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result) => result.transcript)
          .join("");
        
        debugLog('Speech recognition result:', transcript);
        
        // Only update the input if we're not currently playing audio
        if (!isSpeaking) {
          setInput(transcript);
          setLastSpeechTimestamp(Date.now());
          
          // If this is a final result (not interim), update the input
          if (!event.results[0].isFinal) {
            debugLog('Interim result, waiting for final result');
            return;
          }
          
          // No auto-send, just update the input
          debugLog('Final speech result detected, updating input');
          // handleSendMessage();
        } else {
          debugLog('Ignoring speech input while patient is speaking');
        }
      };

      recognition.current.onend = () => {
        debugLog('Speech recognition ended');
        // Only try to restart if we're still supposed to be listening
        // and we haven't just sent a message
        if (isListening && !isSpeaking) {
          debugLog('Attempting to restart speech recognition');
          try {
            recognition.current?.start();
          } catch (error) {
            debugLog('Error restarting speech recognition:', error);
            setIsListening(false);
            isRecognitionActive.current = false;
          }
        }
      };

      recognition.current.onerror = (event: any) => {
        debugLog('Speech recognition error:', event.error);
        
        if (event.error === 'not-allowed') {
          debugLog('Microphone permission denied');
          setIsListening(false);
          isRecognitionActive.current = false;
          console.error('Microphone permission denied. Please allow microphone access and reload the page.');
        } else if (event.error === 'network') {
          debugLog('Network error detected, attempting to recover');
          // Try to restart after a short delay
          setTimeout(() => {
            if (isListening && !isSpeaking) {
              try {
                recognition.current?.start();
              } catch (error) {
                debugLog('Error recovering from network error:', error);
                setIsListening(false);
                isRecognitionActive.current = false;
              }
            }
          }, 1000);
        } else {
          console.error('Speech recognition error:', event.error);
        }
      };
      
      isRecognitionInitialized.current = true;
      debugLog('Speech recognition setup complete');
    } catch (error) {
      debugLog('Error setting up speech recognition:', error);
      console.error('Speech recognition setup error:', error);
    }
    
    // Cleanup function
    return () => {
      if (recognition.current) {
        try {
          recognition.current.stop();
          isRecognitionActive.current = false;
          debugLog('Speech recognition cleanup');
        } catch (error) {
          debugLog('Error during speech recognition cleanup:', error);
        }
      }
    };
  }, [SpeechRecognition]);

  // Scroll to bottom of message list when new messages arrive
  useEffect(() => {
    debugLog('Messages updated, scrolling to bottom');
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Speak initial greeting when component loads - but only after user interaction and only once
  useEffect(() => {
    // Don't auto-play greeting until user has interacted with the page
    if (needsUserInteraction || initialGreetingPlayed) {
      debugLog('Skipping initial greeting - waiting for interaction or already played');
      return;
    }
    
    // Speak the initial greeting after user interaction (only once)
    const initialGreeting = messages[0]?.content;
    if (initialGreeting) {
      debugLog('Speaking initial greeting after user interaction');
      speakWithElevenLabs(initialGreeting);
      setInitialGreetingPlayed(true); // Mark as played
    }
  }, [needsUserInteraction, initialGreetingPlayed]); // Removed messages dependency

  const toggleListening = () => {
    // Handle the first user interaction
    if (needsUserInteraction) {
      debugLog('First user interaction detected, initializing features');
      setNeedsUserInteraction(false);
      return; // The useEffects will handle starting speech and playing greeting
    }
    
    // Normal toggle behavior
    debugLog('Toggle listening:', !isListening);
    isManualToggle.current = true;
    
    // Never toggle while speaking
    if (isSpeaking) {
      debugLog('Cannot toggle speech recognition while patient is speaking');
      return;
    }
    
    if (isListening) {
      try {
        recognition.current?.stop();
        setIsListening(false);
        isRecognitionActive.current = false;
      } catch (error) {
        debugLog('Error stopping speech recognition:', error);
      }
    } else {
      // Add a small delay before starting to ensure clean state
      setTimeout(() => {
        try {
          recognition.current?.start();
          setIsListening(true);
          isRecognitionActive.current = true;
        } catch (error) {
          debugLog('Error starting speech recognition:', error);
          console.error('Failed to start speech recognition:', error);
          setIsListening(false);
          isRecognitionActive.current = false;
        }
      }, 100);
    }
  };

  // Function to play text using ElevenLabs
  const speakWithElevenLabs = async (text: string) => {
    if (!text || isSpeaking || !audioRef.current) return;
    
    debugLog('Speaking with ElevenLabs:', text);
    
    // Temporarily disable speech recognition while the patient is speaking
    if (isListening) {
      debugLog('Pausing speech recognition while patient speaks');
      try {
        recognition.current?.stop();
        setIsListening(false);
      } catch (error) {
        debugLog('Error stopping speech recognition:', error);
      }
    }
    
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
      
      // Get the audio data as blob
      const audioBlob = await response.blob();
      debugLog('Audio blob received, size:', audioBlob.size, 'type:', audioBlob.type);
      
      if (audioBlob.size === 0) {
        throw new Error('Received empty audio blob from speech API');
      }
      
      // Create object URL for audio playback
      const audioUrl = URL.createObjectURL(audioBlob);
      debugLog('Created audio URL:', audioUrl);
      
      // Set speaking state before playing
      setIsSpeaking(true);
      
      // Stop any currently playing audio
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (error) {
        debugLog('Error stopping previous audio:', error);
      }
      
      // Clean up old object URL if it exists
      if (audioRef.current.src && audioRef.current.src.startsWith('blob:')) {
        URL.revokeObjectURL(audioRef.current.src);
      }
      
      // Set new source and play
      audioRef.current.src = audioUrl;
      
      // Add event listeners for audio playback
      const handleLoadedMetadata = () => {
        debugLog('Audio metadata loaded');
      };
      
      const handleCanPlay = () => {
        debugLog('Audio can play');
      };
      
      const handleEnded = () => {
        debugLog('Audio playback ended');
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        
        // Auto-start listening after patient stops speaking
        if (!textOnlyMode && !isListening) {
          debugLog('Auto-starting speech recognition after patient stops speaking');
          setTimeout(() => {
            try {
              recognition.current?.start();
              setIsListening(true);
              isRecognitionActive.current = true;
            } catch (error) {
              debugLog('Error auto-starting speech recognition:', error);
            }
          }, 500); // Small delay before starting
        }
      };
      
      const handleError = (error: Event) => {
        debugLog('Audio playback error:', error);
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        console.error('Audio playback error:', error);
        
        // Auto-start listening even if there's an error
        if (!textOnlyMode && !isListening) {
          debugLog('Auto-starting speech recognition after audio error');
          setTimeout(() => {
            try {
              recognition.current?.start();
              setIsListening(true);
              isRecognitionActive.current = true;
            } catch (error) {
              debugLog('Error auto-starting speech recognition:', error);
            }
          }, 500);
        }
      };
      
      audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      audioRef.current.addEventListener('canplay', handleCanPlay);
      audioRef.current.addEventListener('ended', handleEnded);
      audioRef.current.addEventListener('error', handleError);
      
      try {
        debugLog('Attempting to play audio...');
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
          await playPromise;
          debugLog('Audio playback started successfully');
        }
      } catch (playError) {
        debugLog('Exception while playing audio:', playError);
        setIsSpeaking(false);
        URL.revokeObjectURL(audioUrl);
        console.error('Audio playback exception:', playError);
        
        // Auto-start listening even if there's a play error
        if (!textOnlyMode && !isListening) {
          debugLog('Auto-starting speech recognition after play error');
          setTimeout(() => {
            try {
              recognition.current?.start();
              setIsListening(true);
              isRecognitionActive.current = true;
            } catch (error) {
              debugLog('Error auto-starting speech recognition:', error);
            }
          }, 500);
        }
      }
      
      // Clean up event listeners
      return () => {
        if (audioRef.current) {
          audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
          audioRef.current.removeEventListener('canplay', handleCanPlay);
          audioRef.current.removeEventListener('ended', handleEnded);
          audioRef.current.removeEventListener('error', handleError);
        }
      };
      
    } catch (error) {
      debugLog('Error in ElevenLabs speech:', error);
      setIsSpeaking(false);
      console.error('ElevenLabs error:', error);
      
      // Auto-start listening even if there's an API error
      if (!textOnlyMode && !isListening) {
        debugLog('Auto-starting speech recognition after API error');
        setTimeout(() => {
          try {
            recognition.current?.start();
            setIsListening(true);
            isRecognitionActive.current = true;
          } catch (error) {
            debugLog('Error auto-starting speech recognition:', error);
          }
        }, 500);
      }
    }
  };

  // Helper function to calculate word overlap ratio between two strings
  const calculateWordOverlap = (str1: string, str2: string): number => {
    const words1 = str1.split(/\s+/).filter(w => w.length > 3);
    const words2 = str2.split(/\s+/).filter(w => w.length > 3);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    let matchCount = 0;
    for (const word of words1) {
      if (words2.includes(word)) {
        matchCount++;
      }
    }
    
    return matchCount / Math.min(words1.length, words2.length);
  };

  // Move handleSendMessage to useCallback to prevent dependency issues
  const handleSendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    
    let userMessage = input.trim();
    debugLog('Preparing to send message:', userMessage);
    
    // More aggressive checks for accidentally captured patient speech
    const lastPatientMessages = messages
      .filter(m => m.role === "patient")
      .slice(-2)
      .map(m => m.content);
    
    // Check for significant overlap with any recent patient responses
    let isProbablyFeedback = false;
    for (const patientMsg of lastPatientMessages) {
      // Convert both to lowercase for better matching
      const patientMsgLower = patientMsg.toLowerCase();
      const userMsgLower = userMessage.toLowerCase();
      
      // Check for substantial overlap
      if (
        // Check if user message is a substring of patient's message
        (patientMsgLower.includes(userMsgLower) && userMessage.length > 10) || 
        // Check if patient's message is a substring of user message
        (userMsgLower.includes(patientMsgLower) && patientMsgLower.length > 10) ||
        // Check for significant word overlap
        calculateWordOverlap(patientMsgLower, userMsgLower) > 0.7
      ) {
        isProbablyFeedback = true;
        debugLog('Detected probable feedback loop - input matches patient response');
        setApiErrors(prev => [...prev, 
          'Feedback loop detected: Your input appears to match the patient\'s response. ' +
          'This happens when your microphone picks up audio from your speakers. ' +
          'Please use headphones or type your responses.'
        ]);
        // Clear the input field when feedback is detected
        setInput("");
        return; // Don't send the message
      }
    }
    
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
  }, [input, isLoading, messages, isListening, isSpeaking, recognition, audioRef, setInput, setMessages, setIsListening, setIsSpeaking, setApiErrors, calculateWordOverlap]);

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage();
  };

  // Handle the first user interaction (Start button click)
  const handleFirstInteraction = () => {
    debugLog('First user interaction detected, initializing features');
    setNeedsUserInteraction(false);
    
    // Don't auto-start speech recognition in text-only mode
    if (textOnlyMode) {
      debugLog('Text-only mode enabled, skipping speech recognition setup');
      setApiErrors(prev => [...prev, 'Text-only mode enabled. Microphone will remain disabled.']);
    }
    // useEffects will handle playing greeting
  };

  // Setup microphone visualization when recognition is active
  useEffect(() => {
    if (!isListening || isSpeaking || needsUserInteraction) {
      // Clean up audio processing if no longer listening
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        try {
          audioContextRef.current.suspend();
        } catch (error) {
          debugLog('Error suspending audio context:', error);
        }
      }
      return;
    }

    // Only setup audio visualization if we're actively listening
    let animationFrame: number;
    
    const setupMicVisualization = async () => {
      try {
        if (!navigator.mediaDevices) {
          debugLog('Media devices not supported in this browser');
          return;
        }
        
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        // Only get the stream if we don't already have one
        if (!micStreamRef.current) {
          debugLog('Getting microphone stream for visualization');
          micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        }
        
        if (!analyserRef.current) {
          const source = audioContextRef.current.createMediaStreamSource(micStreamRef.current);
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 256;
          analyserRef.current.smoothingTimeConstant = 0.8;
          source.connect(analyserRef.current);
        }
        
        const analyser = analyserRef.current;
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        
        const updateVolume = () => {
          if (!isListening || isSpeaking) return;
          
          analyser.getByteFrequencyData(dataArray);
          // Calculate volume level from frequency data
          const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
          const volume = Math.min(100, Math.round((average / 256) * 100));
          setMicVolume(volume);
          
          // Continue animation loop if still listening
          if (isListening && !isSpeaking) {
            animationFrame = requestAnimationFrame(updateVolume);
          }
        };
        
        animationFrame = requestAnimationFrame(updateVolume);
        debugLog('Microphone visualization setup complete');
        
      } catch (error) {
        debugLog('Error setting up mic visualization:', error);
        setApiErrors(prev => [...prev, `Microphone visualization error: ${(error as Error).message}`]);
      }
    };
    
    setupMicVisualization();
    
    // Cleanup function
    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [isListening, isSpeaking, needsUserInteraction]);

  // Cleanup audio context when component unmounts
  useEffect(() => {
    return () => {
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
        micStreamRef.current = null;
      }
      
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      analyserRef.current = null;
    };
  }, []);

  // Remove the auto-stop effect completely
  useEffect(() => {
    // This effect is intentionally empty to disable auto-stop
    return () => {};
  }, []);

  // Remove the auto-send effect completely
  useEffect(() => {
    // This effect is intentionally empty to disable auto-send
    return () => {};
  }, []);

  // Reset manual toggle flag when speaking state changes
  useEffect(() => {
    if (!isSpeaking) {
      isManualToggle.current = false;
    }
  }, [isSpeaking]);

  if (sessionEnded) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="bg-blue-700 text-white p-6">
          <h1 className="text-3xl font-bold">Simulation Complete</h1>
        </header>
        
        <main className="flex-grow p-6 max-w-4xl mx-auto w-full">
          <div className="bg-white shadow-md rounded-lg p-6 mb-6">
            <h2 className="text-2xl font-semibold mb-4">Feedback on Your Interaction</h2>
            <div className="prose prose-blue max-w-none bg-gray-50 p-4 rounded">
              {feedback ? (
                <ReactMarkdown 
                  components={{
                    h1: ({node, ...props}) => <h1 className="text-2xl font-bold mt-4 mb-2" {...props} />,
                    h2: ({node, ...props}) => <h2 className="text-xl font-bold mt-4 mb-2" {...props} />,
                    h3: ({node, ...props}) => <h3 className="text-lg font-bold mt-3 mb-2" {...props} />,
                    p: ({node, ...props}) => <p className="mb-2" {...props} />,
                    ul: ({node, ...props}) => <ul className="list-disc pl-5 mb-2" {...props} />,
                    ol: ({node, ...props}) => <ol className="list-decimal pl-5 mb-2" {...props} />,
                    li: ({node, ...props}) => <li className="mb-1" {...props} />,
                    strong: ({node, ...props}) => <strong className="font-bold" {...props} />,
                    em: ({node, ...props}) => <em className="italic" {...props} />
                  }}
                >
                  {feedback}
                </ReactMarkdown>
              ) : (
                "Feedback is being generated..."
              )}
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
        <h1 className="text-3xl font-bold">SimPatient</h1>
        <p className="mt-2">Interact with Mr. Johnson</p>
      </header>
      
      {/* Add audio element */}
      <audio ref={audioRef} className="hidden" />
      
      <main className="flex-grow p-4 md:p-6 max-w-4xl mx-auto w-full flex flex-col">
        {/* First-time user interaction prompt */}
        {needsUserInteraction && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-4 flex flex-col items-center">
            <p className="font-bold mb-2">Click the button below to start the simulation</p>
            <div className="flex flex-col mb-4 items-center">
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id="textOnlyMode"
                  checked={textOnlyMode}
                  onChange={(e) => setTextOnlyMode(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="textOnlyMode" className="text-sm">
                  Enable Text-Only Mode (use if microphone isn't working)
                </label>
              </div>
              <button 
                onClick={handleFirstInteraction}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-4 rounded-md"
              >
                Start Simulation
              </button>
            </div>
            <p className="text-sm">This interaction is needed to enable audio features in your browser</p>
            <p className="text-sm mt-2 font-bold">⚠️ For best results, please use headphones to prevent feedback</p>
            
            {/* Microphone test feature - only show if not in text-only mode */}
            {!textOnlyMode && (
              <div className="mt-4 border-t border-yellow-300 pt-3 w-full">
                <p className="text-sm font-medium mb-2">Not working? Test your microphone:</p>
                <button
                  onClick={async () => {
                    try {
                      debugLog('Testing microphone access');
                      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                      
                      // Setup temporary audio context to test microphone
                      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
                      const analyser = audioContext.createAnalyser();
                      const source = audioContext.createMediaStreamSource(stream);
                      source.connect(analyser);
                      analyser.fftSize = 256;
                      
                      const dataArray = new Uint8Array(analyser.frequencyBinCount);
                      let testVolume = 0;
                      
                      // Start checking for audio input
                      const testMicInterval = setInterval(() => {
                        analyser.getByteFrequencyData(dataArray);
                        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
                        testVolume = Math.min(100, Math.round((average / 256) * 100));
                        setMicVolume(testVolume); // Use the same state for visualization
                        
                        if (testVolume > 10) {
                          clearInterval(testMicInterval);
                          debugLog('Microphone test successful, volume detected:', testVolume);
                          console.log('Microphone test successful! Volume level:', testVolume + '%');
                          
                          // Clean up test resources
                          setTimeout(() => {
                            stream.getTracks().forEach(track => track.stop());
                            audioContext.close();
                          }, 1000);
                        }
                      }, 100);
                      
                      // Stop checking after 5 seconds if no sound detected
                      setTimeout(() => {
                        clearInterval(testMicInterval);
                        if (testVolume <= 10) {
                          debugLog('Microphone test failed, no volume detected');
                          console.log('Microphone test failed. No audio detected. Please check your microphone settings.');
                        }
                        
                        // Clean up test resources
                        stream.getTracks().forEach(track => track.stop());
                        audioContext.close();
                      }, 5000);
                      
                    } catch (error) {
                      debugLog('Error testing microphone:', error);
                      console.error('Microphone test error:', error);
                    }
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white text-sm py-1 px-3 rounded"
                >
                  Test Microphone
                </button>
                
                {/* Show temporary mic level during test */}
                {micVolume > 0 && needsUserInteraction && (
                  <div className="mt-2">
                    <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className={`h-full ${micVolume > 30 ? (micVolume > 70 ? 'bg-green-500' : 'bg-green-400') : 'bg-blue-500'}`}
                        style={{ width: `${micVolume}%`, transition: 'width 0.1s ease' }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs mt-1">
                      <span>Low</span>
                      <span>Level: {micVolume}%</span>
                      <span>High</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Text-only mode indicator */}
        {!needsUserInteraction && textOnlyMode && (
          <div className="bg-purple-50 border border-purple-200 text-purple-700 px-4 py-2 rounded mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm">Text-Only Mode Enabled - Using keyboard input only</p>
          </div>
        )}
        
        {/* Headphone recommendation if not using first-time interaction prompt */}
        {!needsUserInteraction && apiErrors.length === 0 && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded mb-4 flex items-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm">For best results, please use headphones to prevent the microphone from picking up audio output</p>
          </div>
        )}
        
        {/* Speaking indicator */}
        {isSpeaking && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded mb-4 flex items-center">
            <div className="mr-2 relative">
              <span className="flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
              </span>
            </div>
            <p>Mr. Johnson is speaking... Speech recognition paused</p>
          </div>
        )}
        
        {/* Microphone active indicator */}
        {isListening && !isSpeaking && !needsUserInteraction && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded mb-4">
            <div className="flex items-center mb-2">
              <div className="mr-2 relative">
                <span className="flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                </span>
              </div>
              <p>Microphone active - speak clearly to enter your response</p>
            </div>
            
            {/* Microphone volume indicator */}
            <div className="w-full h-6 bg-gray-200 rounded-full overflow-hidden mt-2">
              <div 
                className={`h-full ${micVolume > 30 ? (micVolume > 70 ? 'bg-green-500' : 'bg-green-400') : 'bg-blue-500'}`}
                style={{ width: `${micVolume}%`, transition: 'width 0.1s ease' }}
              ></div>
            </div>
            <div className="flex justify-between text-xs mt-1">
              <span>Low</span>
              <span>Mic Level: {micVolume}%</span>
              <span>High</span>
            </div>
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
            {!textOnlyMode && (
              <button 
                type="button"
                onClick={toggleListening}
                className={`${isListening ? "bg-red-500 hover:bg-red-600" : "bg-blue-500 hover:bg-blue-600"} text-white rounded-full p-2 flex-shrink-0 ${(isSpeaking || needsUserInteraction) ? "opacity-50 cursor-not-allowed" : ""}`}
                title={needsUserInteraction ? "Click the 'Start Simulation' button first" : isListening ? "Stop listening" : "Start listening"}
                disabled={isSpeaking || needsUserInteraction}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
            )}
            <div className="flex-grow relative">
              <input
                type="text"
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setLastSpeechTimestamp(Date.now()); // Count typing as speech activity
                }}
                placeholder={
                  needsUserInteraction ? "Click 'Start Simulation' button above first" :
                  textOnlyMode ? "Type your response and press Enter..." :
                  isSpeaking ? "Patient is speaking..." : 
                  isListening ? "Speak clearly or type your message here..." : 
                  "Microphone is disabled. Type your message or click the mic button..."
                }
                className="w-full border rounded-md px-3 py-2"
                disabled={isLoading || isSpeaking || needsUserInteraction}
              />
              
              {/* Auto-send countdown indicator - don't show in text-only mode */}
              {!textOnlyMode && autoSendCountdown !== null && autoSendCountdown > 0 && (
                <div className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-blue-100 rounded-full w-6 h-6 flex items-center justify-center text-blue-600 text-xs font-bold">
                  {autoSendCountdown}
                </div>
              )}
            </div>
            <button 
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-md disabled:opacity-50"
              disabled={isLoading || !input.trim() || isSpeaking || needsUserInteraction}
            >
              {isLoading ? "..." : "Send"}
            </button>
          </form>
        </div>
        
        <div className="mt-4 text-sm text-gray-600">
          <p>Type "STOP" to end the consultation and receive feedback.</p>
          {textOnlyMode && (
            <p className="text-purple-600 mt-1">📝 Text-Only Mode - type your responses and press Enter or Send.</p>
          )}
          {!textOnlyMode && isListening && !isSpeaking && (
            <p className="text-blue-600 mt-1">
              🎤 Microphone is active - speak clearly to enter your response. 
              <span className="font-medium"> Input will auto-send after 2 seconds of silence.</span>
            </p>
          )}
          {!textOnlyMode && !isListening && !isSpeaking && (
            <p className="text-orange-600 mt-1">🔇 Microphone is disabled - click the mic button to enable.</p>
          )}
          {isSpeaking && <p className="text-green-600 mt-1">🔈 Speech recognition is paused while the patient is speaking.</p>}
        </div>
      </main>
    </div>
  );
} 