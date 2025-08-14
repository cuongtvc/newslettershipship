import type { APIRoute } from 'astro';
import { withAdminAuth } from '../../../middleware/admin-auth.js';
import type { Subscriber } from '../../../lib/email/types.js';

export const GET: APIRoute = withAdminAuth(async ({ request, locals, url }) => {
  try {
    const kv = locals.runtime?.env?.NEWSLETTER_KV;
    if (!kv) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Service unavailable'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const action = url.searchParams.get('action');

    switch (action) {
      case 'count':
        const count = await kv.get('subscriber_count') || '0';
        return new Response(JSON.stringify({
          success: true,
          count: parseInt(count)
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      case 'list':
        // Get pagination parameters
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '20');
        const offset = (page - 1) * limit;

        // Get all subscriber keys first
        const allKeys = await kv.list({ prefix: 'subscriber:' });
        const totalCount = allKeys.keys.length;
        const totalPages = Math.ceil(totalCount / limit);

        // Get all subscribers and sort by date
        const allSubscribers = await Promise.all(
          allKeys.keys.map(async (key) => {
            const subscriber = await kv.get(key.name, 'json') as Subscriber;
            return {
              email: subscriber.email, // Show full email for admin
              subscribedAt: subscriber.subscribedAt,
              status: subscriber.status,
              confirmedAt: subscriber.confirmedAt,
              tokenExpiresAt: subscriber.tokenExpiresAt
            };
          })
        );

        // Sort by subscription date (newest first) and apply pagination
        const sortedSubscribers = allSubscribers.sort((a, b) => 
          new Date(b.subscribedAt).getTime() - new Date(a.subscribedAt).getTime()
        );
        
        const paginatedSubscribers = sortedSubscribers.slice(offset, offset + limit);

        return new Response(JSON.stringify({
          success: true,
          subscribers: paginatedSubscribers,
          pagination: {
            currentPage: page,
            totalPages: totalPages,
            totalCount: totalCount,
            limit: limit,
            hasNext: page < totalPages,
            hasPrevious: page > 1
          }
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });

      default:
        return new Response(JSON.stringify({
          success: false,
          message: 'Invalid action'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
    }

  } catch (error) {
    console.error('Subscriber management error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to retrieve subscribers'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

export const POST: APIRoute = withAdminAuth(async ({ request, locals }) => {
  try {
    const kv = locals.runtime?.env?.NEWSLETTER_KV;
    if (!kv) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Service unavailable'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const formData = await request.formData();
    const csvData = formData.get('csv')?.toString();

    if (!csvData) {
      return new Response(JSON.stringify({
        success: false,
        message: 'CSV data is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Parse CSV and validate emails
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const lines = csvData.split('\n').map(line => line.trim()).filter(line => line);
    
    let added = 0;
    let skipped = 0;
    let invalid = 0;
    const errors: string[] = [];

    for (const line of lines) {
      const email = line.toLowerCase().trim();
      
      // Validate email format
      if (!emailRegex.test(email)) {
        invalid++;
        errors.push(`Invalid email format: ${email}`);
        continue;
      }

      // Check if email already exists
      const existingSubscriber = await kv.get(`subscriber:${email}`, 'json') as Subscriber | null;
      
      if (existingSubscriber) {
        skipped++;
        continue;
      }

      // Create new subscriber
      const subscriber: Subscriber = {
        email,
        subscribedAt: new Date().toISOString(),
        status: 'active',
        confirmedAt: new Date().toISOString(), // Mark as confirmed since it's bulk upload
        userAgent: request.headers.get('user-agent') || undefined,
        ip: request.headers.get('cf-connecting-ip') || undefined,
      };

      await kv.put(`subscriber:${email}`, JSON.stringify(subscriber));
      added++;
    }

    // Update subscriber count
    const currentCount = await kv.get('subscriber_count') || '0';
    const newCount = parseInt(currentCount) + added;
    await kv.put('subscriber_count', newCount.toString());

    return new Response(JSON.stringify({
      success: true,
      results: {
        added,
        skipped,
        invalid,
        errors: errors.slice(0, 10) // Limit errors to first 10
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Bulk upload error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Bulk upload failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

export const DELETE: APIRoute = withAdminAuth(async ({ request, locals }) => {
  try {
    const formData = await request.formData();
    const email = formData.get('email')?.toString()?.toLowerCase().trim();

    if (!email) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Email is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const kv = locals.runtime?.env?.NEWSLETTER_KV;
    if (!kv) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Service unavailable'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get existing subscriber
    const existingSubscriber = await kv.get(`subscriber:${email}`, 'json') as Subscriber | null;
    
    if (!existingSubscriber) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Subscriber not found'
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Mark as unsubscribed instead of deleting
    existingSubscriber.status = 'unsubscribed';
    await kv.put(`subscriber:${email}`, JSON.stringify(existingSubscriber));

    // Decrease subscriber count
    const currentCount = await kv.get('subscriber_count') || '0';
    const newCount = Math.max(0, parseInt(currentCount) - 1);
    await kv.put('subscriber_count', newCount.toString());

    return new Response(JSON.stringify({
      success: true,
      message: 'Successfully unsubscribed'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Unsubscribe error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to unsubscribe'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});