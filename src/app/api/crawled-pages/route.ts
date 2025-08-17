import { NextRequest, NextResponse } from 'next/server';
import { pageTrackingService } from '@/lib/database-supabase';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get('categoryId');
    const action = searchParams.get('action');

    if (!categoryId) {
      return NextResponse.json(
        { success: false, error: 'categoryId is required' },
        { status: 400 }
      );
    }

    const catId = parseInt(categoryId);

    switch (action) {
      case 'pages':
        const existingPages = await pageTrackingService.getExistingPages(catId);
        return NextResponse.json({ 
          success: true, 
          data: existingPages,
          message: `Found ${existingPages.length} pages with data` 
        });

      case 'stats':
        const stats = await pageTrackingService.getCrawlStats(catId);
        return NextResponse.json({ 
          success: true, 
          data: stats 
        });

      case 'next':
        const endPage = parseInt(searchParams.get('endPage') || '50');
        const { startPage, pages } = await pageTrackingService.getNextPagesToCrawl(catId, endPage);
        const lastPage = await pageTrackingService.getLastCrawledPage(catId);
        
        let message;
        if (pages.length === 0) {
          if (lastPage >= endPage) {
            message = `Reached maximum page limit (${endPage}). No more crawling needed.`;
          } else {
            message = `All available pages already crawled (up to page ${lastPage}).`;
          }
        } else {
          message = `Next crawl starts from page ${startPage} (${pages.length} pages remaining, max: ${endPage})`;
        }
        
        return NextResponse.json({ 
          success: true, 
          data: { startPage, pages, lastPage, maxPage: endPage },
          message 
        });

      case 'last':
        const lastCrawledPage = await pageTrackingService.getLastCrawledPage(catId);
        return NextResponse.json({ 
          success: true, 
          data: { lastPage: lastCrawledPage },
          message: `Last crawled page: ${lastCrawledPage}` 
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: pages, stats, next, or last' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('❌ Error in crawled-pages API:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, categoryId } = body;

    if (!categoryId) {
      return NextResponse.json(
        { success: false, error: 'categoryId is required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'reset':
        await pageTrackingService.resetCategory(categoryId);
        return NextResponse.json({ 
          success: true, 
          message: `Reset all product_links for category ${categoryId} - ready to crawl again` 
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Use: reset' },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error('❌ Error in crawled-pages API:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
