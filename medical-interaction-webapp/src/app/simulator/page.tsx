"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

export default function Simulator() {
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<{ role: "user" | "patient"; content: string }[]>([
    { role: "patient", content: "Hello, I'm Mr. Johnson. I've been having a sore throat for the past couple of days." }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);
  const [feedback, setFeedback] = useState("");
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Speech recognition setup
  const SpeechRecognition = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null;
  const recognition = useRef<any>(null);

  useEffect(() => {
    if (SpeechRecognition) {
      recognition.current = new SpeechRecognition();
      recognition.current.continuous = true;
      recognition.current.interimResults = true;
      
      recognition.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0])
          .map((result) => result.transcript)
          .join("");
          
        setInput(transcript);
      };

      recognition.current.onend = () => {
        if (isListening) {
          recognition.current.start();
        }
      };
    }
  }, [SpeechRecognition, isListening]);

  // Scroll to bottom of message list when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const toggleListening = () => {
    if (isListening) {
      recognition.current?.stop();
      setIsListening(false);
    } else {
      try {
        recognition.current?.start();
        setIsListening(true);
      } catch (error) {
        console.error("Error starting speech recognition:", error);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    // Stop listening if active
    if (isListening) {
      recognition.current?.stop();
      setIsListening(false);
    }

    const userMessage = input.trim();
    setInput("");
    
    // Add user message to chat
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    
    // Check if user wants to end session
    if (userMessage.toUpperCase() === "STOP") {
      setIsLoading(true);
      try {
        // Get feedback from API
        const response = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages })
        });
        
        if (!response.ok) throw new Error("Failed to get feedback");
        
        const data = await response.json();
        setFeedback(data.feedback);
        setSessionEnded(true);
      } catch (error) {
        console.error("Error getting feedback:", error);
      } finally {
        setIsLoading(false);
      }
      return;
    }
    
    // Get response from API
    setIsLoading(true);
    try {
      const response = await fetch("/api/patient", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: userMessage, 
          history: messages 
        })
      });
      
      if (!response.ok) throw new Error("Failed to get patient response");
      
      const data = await response.json();
      
      // Add patient response to chat
      setMessages((prev) => [...prev, { role: "patient", content: data.response }]);
      
      // Speak the response if browser supports speech synthesis
      if (window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(data.response);
        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      console.error("Error getting patient response:", error);
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
              Send
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