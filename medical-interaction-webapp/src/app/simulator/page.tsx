"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  
  // Speech recognition setup
  const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const recognition = useRef<any>(null);

  // Auto-start speech recognition after component is mounted
  useEffect(() => {
    // Don't do anything until user has interacted with the page
    if (needsUserInteraction) {
      debugLog('Waiting for user interaction before starting speech recognition');
      return;
    }
    
    // Only attempt to start if not already listening and not speaking
    if (SpeechRecognition && !isListening && !isSpeaking) {
      debugLog('Auto-starting speech recognition after user interaction');
      try {
        if (recognition.current) {
          recognition.current.start();
          debugLog('Speech recognition auto-started successfully');
          setIsListening(true);
        } else {
          debugLog('Speech recognition not initialized yet');
        }
      } catch (error) {
        debugLog('Error auto-starting speech recognition:', error);
        setApiErrors(prev => [...prev, `Failed to auto-start speech recognition: ${(error as Error).message}`]);
      }
    } else {
      if (isListening) {
        debugLog('Not auto-starting speech recognition because it is already active');
      } else if (isSpeaking) {
        debugLog('Not auto-starting speech recognition because patient is speaking');
      } else if (!SpeechRecognition) {
        debugLog('Speech recognition not available in this browser');
      }
    }
  }, [SpeechRecognition, isSpeaking, isListening, needsUserInteraction]);

  useEffect(() => {
    debugLog('Simulator component mounted');
    
    // Create audio element for ElevenLabs TTS
    if (typeof window !== 'undefined' && !audioRef.current) {
      audioRef.current = new Audio();
      
      // Add event listeners
      audioRef.current.addEventListener('play', () => {
        debugLog('Audio started playing');
        setIsSpeaking(true);
        
        // Always stop speech recognition when patient speaks
        if (recognition.current && isListening) {
          debugLog('Making sure speech recognition is stopped while audio plays');
          try {
            recognition.current.stop();
            setIsListening(false);
          } catch (error) {
            debugLog('Error stopping speech recognition during audio playback:', error);
          }
        }
      });
      
      audioRef.current.addEventListener('ended', () => {
        debugLog('Audio finished playing');
        setIsSpeaking(false);
        
        // Add a delay before re-enabling speech recognition
        // This helps prevent the last bit of audio from being picked up
        setTimeout(() => {
          // Only restart speech recognition if we're not already in the process of speaking
          // and user interaction has been completed
          if (!needsUserInteraction && !isSpeaking && recognition.current && SpeechRecognition) {
            debugLog('Audio playback fully complete, attempting to restart speech recognition');
            try {
              recognition.current.start();
              setIsListening(true);
              debugLog('Successfully restarted speech recognition after audio');
            } catch (error) {
              debugLog('Error restarting speech recognition after audio:', error);
              setApiErrors(prev => [...prev, `Error restarting recognition: ${(error as Error).message}`]);
            }
          } else {
            debugLog('Not auto-restarting speech recognition after audio', {
              needsUserInteraction,
              isSpeaking,
              recognitionExists: !!recognition.current
            });
          }
        }, 1000); // Longer delay to ensure no audio feedback
      });
      
      audioRef.current.addEventListener('error', (e) => {
        debugLog('Audio playback error', e);
        setIsSpeaking(false);
        setApiErrors(prev => [...prev, `Audio playback error: ${(e as any).message || 'Unknown error'}`]);
      });
      
      // Add pause event listener
      audioRef.current.addEventListener('pause', () => {
        debugLog('Audio playback paused');
        if (audioRef.current?.currentTime === audioRef.current?.duration) {
          debugLog('Audio playback completed');
        }
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
  }, [isListening]); // Add isListening as a dependency

  useEffect(() => {
    if (SpeechRecognition) {
      debugLog('Setting up speech recognition');
      
      // Create a new instance of speech recognition
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
          // This helps prevent feedback loops
          if (!isSpeaking) {
            setInput(transcript);
          } else {
            debugLog('Ignoring speech input while patient is speaking');
          }
        };

        recognition.current.onend = () => {
          debugLog('Speech recognition ended, isListening state:', isListening);
          
          // Only restart if we intend to be listening and we're not speaking
          if (isListening && !isSpeaking) {
            debugLog('Restarting speech recognition');
            try {
              // Small delay to prevent rapid restarts
              setTimeout(() => {
                if (isListening && !isSpeaking) {
                  recognition.current.start();
                  debugLog('Speech recognition restarted successfully');
                }
              }, 300);
            } catch (error) {
              debugLog('Error restarting speech recognition:', error);
              setApiErrors(prev => [...prev, `Error restarting speech recognition: ${(error as Error).message}`]);
              // Reset listening state if we can't restart
              setIsListening(false);
            }
          } else {
            debugLog('Not restarting speech recognition because', 
              isListening ? 'patient is speaking' : 'listening is disabled');
          }
        };

        recognition.current.onerror = (event: any) => {
          debugLog('Speech recognition error:', event.error);
          setApiErrors(prev => [...prev, `Speech recognition error: ${event.error}`]);
          
          // Handle specific errors
          if (event.error === 'not-allowed') {
            debugLog('Microphone permission denied');
            setIsListening(false);
            setApiErrors(prev => [...prev, 'Microphone permission denied. Please allow microphone access and reload the page.']);
          } else if (event.error === 'network') {
            debugLog('Network error in speech recognition');
            // Don't immediately restart on network errors
            setIsListening(false);
          } else if (event.error === 'aborted') {
            // This is expected when we manually stop recognition
            debugLog('Speech recognition was aborted');
          }
        };
        
        debugLog('Speech recognition setup complete');
      } catch (error) {
        debugLog('Error setting up speech recognition:', error);
        setApiErrors(prev => [...prev, `Speech recognition setup error: ${(error as Error).message}`]);
      }
    } else {
      debugLog('Speech recognition not available in this browser');
      setApiErrors(prev => [...prev, 'Speech recognition is not supported in this browser']);
    }
    
    // Cleanup function
    return () => {
      if (recognition.current) {
        try {
          if (isListening) {
            recognition.current.stop();
          }
          debugLog('Speech recognition cleanup');
        } catch (error) {
          debugLog('Error during speech recognition cleanup:', error);
        }
      }
    };
  }, [SpeechRecognition, isListening, isSpeaking]); // Added isSpeaking as dependency

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
    
    // Never toggle while speaking
    if (isSpeaking) {
      debugLog('Cannot toggle speech recognition while patient is speaking');
      return;
    }
    
    if (isListening) {
      try {
        recognition.current?.stop();
        setIsListening(false);
      } catch (error) {
        debugLog('Error stopping speech recognition:', error);
      }
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
    
    // Temporarily disable speech recognition while the patient is speaking
    if (isListening) {
      debugLog('Pausing speech recognition while patient speaks');
      recognition.current?.stop();
      setIsListening(false);
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
      
      // Log response headers for debugging
      const headers: Record<string, string> = {};
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

  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage();
  };

  // Handle the first user interaction (Start button click)
  const handleFirstInteraction = () => {
    debugLog('User clicked Start Simulation button');
    setNeedsUserInteraction(false);
    
    // After a short delay, auto-start speech recognition if available
    setTimeout(() => {
      if (SpeechRecognition && recognition.current && !isListening && !isSpeaking) {
        try {
          debugLog('Starting speech recognition after Start button click');
          recognition.current.start();
          setIsListening(true);
        } catch (error) {
          debugLog('Error starting speech recognition after button click:', error);
        }
      }
    }, 500);
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
        
        {/* First-time user interaction prompt */}
        {needsUserInteraction && (
          <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 px-4 py-3 rounded mb-4 flex flex-col items-center">
            <p className="font-bold mb-2">Click the button below to start the simulation</p>
            <button 
              onClick={handleFirstInteraction}
              className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-4 rounded-md"
            >
              Start Simulation
            </button>
            <p className="text-sm mt-2">This interaction is needed to enable audio and speech features in your browser</p>
            <p className="text-sm mt-2 font-bold">⚠️ For best results, please use headphones to prevent feedback</p>
            
            {/* Microphone test feature */}
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
                        setApiErrors(prev => [...prev, `Microphone test successful! Volume level: ${testVolume}%`]);
                        
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
                        setApiErrors(prev => [...prev, 'Microphone test failed. No audio detected. Please check your microphone settings.']);
                      }
                      
                      // Clean up test resources
                      stream.getTracks().forEach(track => track.stop());
                      audioContext.close();
                    }, 5000);
                    
                  } catch (error) {
                    debugLog('Error testing microphone:', error);
                    setApiErrors(prev => [...prev, `Microphone test error: ${(error as Error).message}`]);
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
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                needsUserInteraction ? "Click 'Start Simulation' button above first" :
                isSpeaking ? "Patient is speaking..." : 
                isListening ? "Speak clearly or type your message here..." : 
                "Microphone is disabled. Type your message or click the mic button..."
              }
              className="flex-grow border rounded-md px-3 py-2"
              disabled={isLoading || isSpeaking || needsUserInteraction}
            />
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
          {isListening && !isSpeaking && (
            <p className="text-blue-600 mt-1">🎤 Microphone is active - speak clearly to enter your response.</p>
          )}
          {!isListening && !isSpeaking && (
            <p className="text-orange-600 mt-1">🔇 Microphone is disabled - click the mic button to enable.</p>
          )}
          {isSpeaking && <p className="text-green-600 mt-1">🔈 Speech recognition is paused while the patient is speaking.</p>}
        </div>
      </main>
    </div>
  );
} 