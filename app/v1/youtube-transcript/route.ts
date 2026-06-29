import { NextResponse } from 'next/server';
import { YoutubeTranscript } from 'youtube-transcript';

// Helper to reliably extract the 11-character YouTube Video ID from standard or shortened URLs
function extractVideoId(url: string): string | null {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export async function GET(request: Request) {
  // 1. THE SECURITY GATE
  const authHeader = request.headers.get('authorization');
  const expectedSecret = process.env.API_MASTER_SECRET;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json([{ success: false, error: 'Unauthorized: Missing Bearer Token' }], { status: 401 });
  }

  const providedToken = authHeader.replace('Bearer ', '').trim();

  if (!expectedSecret || providedToken !== expectedSecret) {
    return NextResponse.json([{ success: false, error: 'Forbidden: Invalid API Token' }], { status: 403 });
  }

  // 2. PARAMETER VALIDATION & ID EXTRACTION
  const { searchParams } = new URL(request.url);
  const videoUrl = searchParams.get('url');

  if (!videoUrl) {
    return NextResponse.json([{ success: false, error: 'Bad Request: Missing "url" query parameter' }], { status: 400 });
  }

  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    return NextResponse.json([{ success: false, error: 'Bad Request: Could not parse a valid YouTube Video ID from the provided URL' }], { status: 400 });
  }

  // 3. EXECUTION
  try {
    const transcriptArray = await YoutubeTranscript.fetchTranscript(videoUrl);
    
    // Concatenate all text segments into a single continuous block of text
    const fullText = transcriptArray
      .map(item => item.text.trim())
      .join(' ');

    // Match the exact target schema (wrapped in an array)
    return NextResponse.json([
      {
        success: true,
        data: {
          videoId: videoId,
          rawTranscript: fullText
        }
      }
    ]);

  } catch (error: any) {
    return NextResponse.json([
      { 
        success: false, 
        error: error.message || 'Failed to extract YouTube transcript' 
      }
    ], { status: 500 });
  }
}