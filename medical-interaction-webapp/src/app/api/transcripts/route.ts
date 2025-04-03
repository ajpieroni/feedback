import { NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Valid messages array is required' },
        { status: 400 }
      );
    }

    // Create a new transcript
    const transcriptResult = await sql`
      INSERT INTO transcripts (id, created_at, updated_at)
      VALUES (gen_random_uuid(), NOW(), NOW())
      RETURNING id
    `;
    const transcriptId = transcriptResult.rows[0].id;

    // Insert all messages
    for (const msg of messages) {
      await sql`
        INSERT INTO messages (id, content, role, transcript_id, created_at)
        VALUES (gen_random_uuid(), ${msg.content}, ${msg.role}, ${transcriptId}, NOW())
      `;
    }

    // Fetch the complete transcript with messages
    const transcript = await sql`
      SELECT t.*, json_agg(json_build_object(
        'id', m.id,
        'content', m.content,
        'role', m.role,
        'createdAt', m.created_at
      ) ORDER BY m.created_at) as messages
      FROM transcripts t
      LEFT JOIN messages m ON t.id = m.transcript_id
      WHERE t.id = ${transcriptId}
      GROUP BY t.id
    `;

    return NextResponse.json({ transcript: transcript.rows[0] });
  } catch (error) {
    console.error('Error saving transcript:', error);
    return NextResponse.json(
      { error: 'Failed to save transcript' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const transcripts = await sql`
      SELECT t.*, json_agg(json_build_object(
        'id', m.id,
        'content', m.content,
        'role', m.role,
        'createdAt', m.created_at
      ) ORDER BY m.created_at) as messages
      FROM transcripts t
      LEFT JOIN messages m ON t.id = m.transcript_id
      GROUP BY t.id
      ORDER BY t.created_at DESC
    `;

    return NextResponse.json({ transcripts: transcripts.rows });
  } catch (error) {
    console.error('Error fetching transcripts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch transcripts' },
      { status: 500 }
    );
  }
} 