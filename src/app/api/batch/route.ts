import { NextRequest, NextResponse } from 'next/server';

// Mark route as dynamic and specify runtime
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Lazy imports to prevent build-time loading
const getBatchDependencies = async () => {
  const [
    {
      BatchProcessor,
      getCrawlProgress,
      stopCrawling,
      resetBatchStats,
      getBatchLogs
    },
    { getCategories }
  ] = await Promise.all([
    import('@/lib/batch-processor'),
    import('@/lib/database-supabase')
  ]);

  return {
    BatchProcessor,
    getCrawlProgress,
    stopCrawling,
    resetBatchStats,
    getBatchLogs,
    getCategories
  };
};

// Global batch processor instance
let batchProcessor: any | null = null;

export async function GET() {
  try {
    // Check if we're in build mode or missing environment variables
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.log('🚨 [BATCH API] Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
      return NextResponse.json({
        success: true,
        data: {
          isRunning: false,
          progress: null,
          logs: ['Environment variables not configured - batch service unavailable']
        }
      });
    }

    // Lazy load dependencies with detailed error handling
    let getBatchDependenciesResult;
    try {
      getBatchDependenciesResult = await getBatchDependencies();
    } catch (depError) {
      console.error('❌ [BATCH API] Failed to load dependencies:', depError);
      return NextResponse.json({
        success: false,
        error: 'Failed to load batch dependencies',
        details: process.env.NODE_ENV !== 'production' ? String(depError) : 'Dependency loading error'
      }, { status: 500 });
    }

    const { getCrawlProgress, getBatchLogs } = getBatchDependenciesResult;

    const progress = getCrawlProgress();
    const isRunning = batchProcessor?.isRunning || false;
    const logs = getBatchLogs();

    return NextResponse.json({
      success: true,
      data: {
        isRunning,
        progress,
        logs
      }
    });
  } catch (error) {
    console.error('❌ [BATCH API] GET Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error in batch API',
      details: process.env.NODE_ENV !== 'production' ? String(error) : 'Server error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if environment variables are missing
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
      console.log('🚨 [BATCH API POST] Missing NEXT_PUBLIC_SUPABASE_URL environment variable');
      return NextResponse.json({
        success: false,
        error: 'Environment variables not configured - batch service unavailable'
      }, { status: 503 });
    }

    const body = await request.json();
    const { action, options = {} } = body;

    console.log(`📦 Batch API: ${action}`, options);

    // Lazy load dependencies with detailed error handling
    let getBatchDependenciesResult;
    try {
      getBatchDependenciesResult = await getBatchDependencies();
    } catch (depError) {
      console.error('❌ [BATCH API POST] Failed to load dependencies:', depError);
      return NextResponse.json({
        success: false,
        error: 'Failed to load batch dependencies',
        details: process.env.NODE_ENV !== 'production' ? String(depError) : 'Dependency loading error'
      }, { status: 500 });
    }

    const { BatchProcessor, getCategories, stopCrawling, resetBatchStats } = getBatchDependenciesResult;

    switch (action) {
      case 'find_bestsellers_batch': {
        if (batchProcessor?.isRunning) {
          return NextResponse.json({
            success: false,
            error: 'Batch operation is already running'
          }, { status: 400 });
        }

        // Get categories that need bestseller URLs
        const categories = await getCategories();
        const categoriesNeedingBestsellers = categories.filter(cat => !cat.bestseller_url);

        if (categoriesNeedingBestsellers.length === 0) {
          return NextResponse.json({
            success: false,
            error: 'All categories already have bestseller URLs'
          }, { status: 400 });
        }

        batchProcessor = new BatchProcessor();

        // Start batch bestseller finding in background
        setImmediate(() => {
          batchProcessor?.startBatchBestsellers(categoriesNeedingBestsellers, {
            threads: options.threads || 20,
            forceRecrawl: options.forceRecrawl || false
          });
        });

        return NextResponse.json({
          success: true,
          message: `Started batch bestseller finding for ${categoriesNeedingBestsellers.length} categories`
        });
      }

      case 'crawl_links_batch': {
        console.log('🚀 [BATCH API] Received crawl_links_batch request with options:', options);

        if (batchProcessor?.isRunning) {
          console.log('⚠️ [BATCH API] Batch processor already running, rejecting request');
          return NextResponse.json({
            success: false,
            error: 'Batch operation is already running'
          }, { status: 400 });
        }

        console.log('📋 [BATCH API] Loading categories from database...');
        const categories = await getCategories();
        console.log(`📊 [BATCH API] Found ${categories.length} total categories`);

        const categoriesWithBestsellers = categories.filter(cat => cat.bestseller_url);
        console.log(`✅ [BATCH API] ${categoriesWithBestsellers.length} categories have bestseller URLs`);
        console.log('📝 [BATCH API] Categories ready for batch processing:', categoriesWithBestsellers.map(c => c.name));

        if (categoriesWithBestsellers.length === 0) {
          console.log('❌ [BATCH API] No categories with bestseller URLs found');
          return NextResponse.json({
            success: false,
            error: 'No categories have bestseller URLs. Find bestsellers first.'
          }, { status: 400 });
        }

        console.log('🔧 [BATCH API] Creating new BatchProcessor...');
        batchProcessor = new BatchProcessor();

        const batchOptions = {
          threads: options.threads || 20,
          startPage: options.startPage || 1,
          endPage: options.endPage || 5
        };
        console.log('⚙️ [BATCH API] Batch options:', batchOptions);

        // Start batch links crawling in background
        console.log('🚀 [BATCH API] Starting batch processor in background...');
        setImmediate(() => {
          console.log('🎯 [BATCH API] Batch processor starting now...');
          batchProcessor?.startBatchLinks(categoriesWithBestsellers, batchOptions);
        });

        const responseMessage = `Started batch links crawling for ${categoriesWithBestsellers.length} categories with ${batchOptions.threads} threads (pages ${batchOptions.startPage}-${batchOptions.endPage})`;
        console.log(`✅ [BATCH API] ${responseMessage}`);

        return NextResponse.json({
          success: true,
          message: responseMessage,
          details: {
            categoriesCount: categoriesWithBestsellers.length,
            ...batchOptions
          }
        });
      }

      case 'stop_batch': {
        if (batchProcessor?.isRunning) {
          await stopCrawling();
          batchProcessor = null;
          resetBatchStats();
        }

        return NextResponse.json({
          success: true,
          message: 'Batch operation stopped'
        });
      }

      default:
        return NextResponse.json({
          success: false,
          error: `Unknown action: ${action}`
        }, { status: 400 });
    }
  } catch (error) {
    console.error('❌ [BATCH API POST] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error in batch API',
      details: process.env.NODE_ENV !== 'production' ? String(error) : 'Server error'
    }, { status: 500 });
  }
}
