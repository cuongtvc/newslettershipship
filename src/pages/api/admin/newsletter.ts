import type { APIRoute } from 'astro';
import { withAdminAuth } from '../../../middleware/admin-auth.js';
import { EmailService } from '../../../lib/email/service.js';
import type { Subscriber } from '../../../lib/email/types.js';

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

    const { subject, content } = await request.json();
    
    if (!subject || !content) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Subject and content are required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get all active subscribers
    const allKeys = await kv.list({ prefix: 'subscriber:' });
    const activeSubscribers = [];
    
    for (const key of allKeys.keys) {
      const subscriber = await kv.get(key.name, 'json') as Subscriber;
      if (subscriber && subscriber.status === 'active') {
        activeSubscribers.push(subscriber);
      }
    }

    if (activeSubscribers.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        message: 'No active subscribers found'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const emailService = new EmailService(locals.runtime.env);
    
    // Fire and forget - send all emails asynchronously
    const sendPromises = activeSubscribers.map((subscriber, index) => 
      // Add small delay between sends to avoid rate limiting
      new Promise<void>(resolve => 
        setTimeout(() => {
          emailService.sendNewsletter({
            to: subscriber.email,
            subject,
            content,
            unsubscribeToken: subscriber.unsubscribeToken
          }).catch(error => {
            console.error(`Failed to send newsletter to ${subscriber.email}:`, error);
          }).finally(() => resolve());
        }, index * 50) // 50ms between each send
      )
    );
    
    // Use waitUntil to continue processing after response is sent
    locals.runtime.ctx.waitUntil(
      Promise.allSettled(sendPromises).then(results => {
        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.length - successful;
        console.log(`Newsletter "${subject}" sent: ${successful} successful, ${failed} failed out of ${activeSubscribers.length} total subscribers`);
      })
    );

    return new Response(JSON.stringify({
      success: true,
      message: `Newsletter sending started for ${activeSubscribers.length} active subscribers`,
      total: activeSubscribers.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Newsletter sending error:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Failed to send newsletter'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});