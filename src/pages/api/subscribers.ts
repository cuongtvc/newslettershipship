import type { APIRoute } from 'astro';
import { verifySession } from './auth.js';

interface Subscriber {
  email: string;
  subscribedAt: string;
  status: 'active' | 'unsubscribed';
  userAgent?: string;
  ip?: string;
}

export const GET: APIRoute = async ({ request, locals, url }) => {
  try {
    // Verify admin session
    const isAuthenticated = await verifySession(request, locals);
    if (!isAuthenticated) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Unauthorized'
      }), {
        status: 401,
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
        // List recent subscribers (limited for security)
        const keys = await kv.list({ prefix: 'subscriber:', limit: 50 });
        const subscribers = await Promise.all(
          keys.keys.map(async (key) => {
            const subscriber = await kv.get(key.name, 'json') as Subscriber;
            return {
              email: subscriber.email.replace(/(.{2}).*(@.*)/, '$1***$2'), // Mask email for privacy
              subscribedAt: subscriber.subscribedAt,
              status: subscriber.status
            };
          })
        );

        return new Response(JSON.stringify({
          success: true,
          subscribers: subscribers.sort((a, b) => 
            new Date(b.subscribedAt).getTime() - new Date(a.subscribedAt).getTime()
          )
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
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    // Verify admin session
    const isAuthenticated = await verifySession(request, locals);
    if (!isAuthenticated) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Unauthorized'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
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
};