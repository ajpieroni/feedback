import { NextResponse } from 'next/server';

// Debug logging
console.log('=== LOADING SPEECH API ROUTE ===');
console.log('ElevenLabs API Key present:', process.env.ELEVEN_API_KEY ? 'Yes' : 'No');
console.log('ElevenLabs API Key prefix:', process.env.ELEVEN_API_KEY ? process.env.ELEVEN_API_KEY.substring(0, 3) + '...' : 'None');

export async function POST(request: Request) {
  console.log('=== SPEECH API CALLED ===');
  console.time('speechApiTotalTime');
  
  try {
    // Parse request body
    console.log('Parsing request body...');
    const body = await request.json();
    const { text } = body;
    
    console.log(`Request received - text length: ${text?.length || 0}`);
    console.log('Text preview:', text?.substring(0, 50));

    if (!text) {
      console.error('Request missing text field');
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    // Check API key - use ELEVEN_API_KEY instead of ELEVENLABS_API_KEY
    const apiKey = process.env.ELEVEN_API_KEY;
    if (!apiKey) {
      console.error('ElevenLabs API key not found');
      console.log('Available environment variables:', Object.keys(process.env).filter(key => !key.startsWith('npm_')));
      return NextResponse.json(
        { error: 'ElevenLabs API key not configured' },
        { status: 500 }
      );
    }

    console.log('API Key found with length:', apiKey.length);
    console.log('API Key prefix:', apiKey.substring(0, 3) + '...');

    try {
      // Use Josh voice (male voice for Mr. Johnson)
      const voiceId = "TxGEqnHWrfWFTfGW9XjX";
      const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
      
      // Headers
      const headers = {
        "Accept": "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey
      };
      
      // Request data
      const data = {
        "text": text,
        "model_id": "eleven_monolingual_v1",
        "voice_settings": {
          "stability": 0.5,
          "similarity_boost": 0.5
        }
      };
      
      console.log('Calling ElevenLabs API...');
      console.log('Request headers:', JSON.stringify(headers, (key, value) => 
        key === 'xi-api-key' ? value.substring(0, 3) + '...' : value
      ));
      console.log('Request payload:', JSON.stringify(data));
      console.time('elevenLabsApiCall');
      
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(data)
      });
      
      console.timeEnd('elevenLabsApiCall');
      console.log('ElevenLabs response status:', response.status);
      console.log('ElevenLabs response headers:', JSON.stringify(Object.fromEntries([...response.headers])));
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('ElevenLabs API error response:', errorText);
        throw new Error(`ElevenLabs API error: ${response.status} ${errorText}`);
      }
      
      // Get audio data as ArrayBuffer
      const audioData = await response.arrayBuffer();
      console.log(`Received audio data: ${audioData.byteLength} bytes`);
      
      if (audioData.byteLength === 0) {
        throw new Error('Received empty audio data from ElevenLabs API');
      }
      
      // Return the audio data with proper content type
      console.timeEnd('speechApiTotalTime');
      
      const audioResponse = new Response(audioData, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(audioData.byteLength),
          'Cache-Control': 'no-cache'
        }
      });
      
      console.log('Sending audio response with headers:', JSON.stringify(Object.fromEntries([...audioResponse.headers])));
      return audioResponse;
      
    } catch (apiError) {
      console.error('Error calling ElevenLabs API:', apiError);
      return NextResponse.json(
        { error: `ElevenLabs API error: ${(apiError as Error).message}` },
        { status: 500 }
      );
    }
    
  } catch (error) {
    console.error('Fatal error in speech API:', error);
    console.timeEnd('speechApiTotalTime');
    return NextResponse.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    );
  }
} 