"use client";

import { useState } from 'react';

export default function ApiTest() {
  const [patientInput, setPatientInput] = useState('');
  const [patientResult, setPatientResult] = useState('');
  const [isPatientLoading, setIsPatientLoading] = useState(false);
  
  const [feedbackResult, setFeedbackResult] = useState('');
  const [isFeedbackLoading, setIsFeedbackLoading] = useState(false);
  
  const testMessages = [
    { role: "patient", content: "Hello, nice to see you." },
    { role: "user", content: "Hello Mr. Johnson, I'm Dr. Smith. I'm sorry to hear you're not feeling well. Can you tell me more about your sore throat?" },
    { role: "patient", content: "It feels scratchy and burns when I swallow. It's getting worse." }
  ];

  const testPatientApi = async () => {
    if (!patientInput.trim()) return;
    
    setIsPatientLoading(true);
    try {
      const response = await fetch('/api/patient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: patientInput,
          history: testMessages
        })
      });
      
      const data = await response.json();
      setPatientResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setPatientResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsPatientLoading(false);
    }
  };
  
  const testFeedbackApi = async () => {
    setIsFeedbackLoading(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: testMessages })
      });
      
      const data = await response.json();
      setFeedbackResult(JSON.stringify(data, null, 2));
    } catch (error) {
      setFeedbackResult(`Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsFeedbackLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">API Testing Page</h1>
      
      <div className="mb-8 p-6 border rounded-lg bg-gray-50">
        <h2 className="text-xl font-semibold mb-4">Test Patient API</h2>
        <div className="mb-4">
          <label className="block mb-2">Doctor's message:</label>
          <textarea 
            value={patientInput}
            onChange={(e) => setPatientInput(e.target.value)}
            className="w-full p-2 border rounded"
            rows={3}
            placeholder="E.g., How long have you had this sore throat?"
          />
        </div>
        
        <button 
          onClick={testPatientApi}
          disabled={isPatientLoading}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {isPatientLoading ? 'Testing...' : 'Test Patient API'}
        </button>
        
        {patientResult && (
          <div className="mt-4">
            <h3 className="font-medium mb-2">Response:</h3>
            <pre className="bg-gray-100 p-3 rounded overflow-auto max-h-60">
              {patientResult}
            </pre>
          </div>
        )}
      </div>
      
      <div className="p-6 border rounded-lg bg-gray-50">
        <h2 className="text-xl font-semibold mb-4">Test Feedback API</h2>
        <p className="mb-4 text-sm">Will use a predefined conversation transcript for testing.</p>
        
        <button 
          onClick={testFeedbackApi}
          disabled={isFeedbackLoading}
          className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {isFeedbackLoading ? 'Testing...' : 'Test Feedback API'}
        </button>
        
        {feedbackResult && (
          <div className="mt-4">
            <h3 className="font-medium mb-2">Response:</h3>
            <pre className="bg-gray-100 p-3 rounded overflow-auto max-h-60">
              {feedbackResult}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
} 