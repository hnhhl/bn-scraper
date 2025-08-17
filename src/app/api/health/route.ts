import { NextResponse } from 'next/server';

// Mark route as dynamic and specify runtime
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    // Check environment variables
    const hasSupabaseUrl = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    const hasSupabaseKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const nodeEnv = process.env.NODE_ENV;

    console.log('🏥 [HEALTH] Environment check:', {
      hasSupabaseUrl,
      hasSupabaseKey,
      nodeEnv,
      supabaseUrlLength: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0
    });

    // Test database connection if environment variables are available
    let databaseStatus = 'Not configured';
    if (hasSupabaseUrl && hasSupabaseKey) {
      try {
        const { initDatabase } = await import('@/lib/database-supabase');
        const db = initDatabase();
        databaseStatus = 'Connected';
      } catch (dbError) {
        console.error('❌ [HEALTH] Database connection failed:', dbError);
        databaseStatus = 'Connection failed';
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Barnes & Noble Scraper API is healthy!',
      environment: nodeEnv,
      platform: process.platform,
      nodeVersion: process.version,
      timestamp: new Date().toISOString(),
      environmentVariables: {
        hasSupabaseUrl,
        hasSupabaseKey,
        supabaseUrlDefined: hasSupabaseUrl,
        supabaseUrlLength: process.env.NEXT_PUBLIC_SUPABASE_URL?.length || 0
      },
      database: databaseStatus
    });
  } catch (error: any) {
    console.error('❌ [HEALTH] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        database: 'Health check failed',
        details: process.env.NODE_ENV !== 'production' ? String(error) : 'Health check error'
      },
      { status: 500 }
    );
  }
}
