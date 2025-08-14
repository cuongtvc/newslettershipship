import type { APIRoute } from 'astro';
import { randomBytes } from 'crypto';

interface Session {
  token: string;
  createdAt: string;
  expiresAt: string;
  ip?: string;
  userAgent?: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const formData = await request.formData();
    const password = formData.get('password')?.toString();

    if (!password) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Password is required',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Get admin password from environment
    const adminPassword = locals.runtime?.env?.ADMIN_PASSWORD;
    if (!adminPassword) {
      console.error('ADMIN_PASSWORD not configured');
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Authentication service unavailable',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify password
    if (password !== adminPassword) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid password',
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Access KV namespace
    const kv = locals.runtime?.env?.NEWSLETTER_KV;
    if (!kv) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Service temporarily unavailable',
        }),
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate session token
    const sessionToken = randomBytes(32).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    const session: Session = {
      token: sessionToken,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      ip: request.headers.get('cf-connecting-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    };

    // Store session in KV
    await kv.put(`session:${sessionToken}`, JSON.stringify(session), {
      expirationTtl: 24 * 60 * 60, // 24 hours in seconds
    });

    // Set secure cookie
    const cookieOptions = [
      `admin_session=${sessionToken}`,
      'HttpOnly',
      'Secure',
      'SameSite=Strict',
      `Max-Age=${24 * 60 * 60}`, // 24 hours
      'Path=/',
    ].join('; ');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Authentication successful',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookieOptions,
        },
      }
    );
  } catch (error) {
    console.error('Authentication error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Authentication failed. Please try again.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    // Get session token from cookie
    const cookieHeader = request.headers.get('cookie');
    const cookies = new URLSearchParams(cookieHeader?.replace(/; /g, '&'));
    const sessionToken = cookies.get('admin_session');

    if (sessionToken) {
      const kv = locals.runtime?.env?.NEWSLETTER_KV;
      if (kv) {
        // Delete session from KV
        await kv.delete(`session:${sessionToken}`);
      }
    }

    // Clear cookie
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Logged out successfully',
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': 'admin_session=; HttpOnly; Secure; SameSite=Strict; Max-Age=0; Path=/',
        },
      }
    );
  } catch (error) {
    console.error('Logout error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Logout failed',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

// Helper function to verify session (can be imported by other API routes)
export async function verifySession(request: Request, locals: any): Promise<boolean> {
  try {
    const cookieHeader = request.headers.get('cookie');
    if (!cookieHeader) return false;

    const cookies = new URLSearchParams(cookieHeader.replace(/; /g, '&'));
    const sessionToken = cookies.get('admin_session');
    if (!sessionToken) return false;

    const kv = locals.runtime?.env?.NEWSLETTER_KV;
    if (!kv) return false;

    const sessionData = await kv.get(`session:${sessionToken}`, 'json') as Session | null;
    if (!sessionData) return false;

    // Check if session is expired
    const now = new Date();
    const expiresAt = new Date(sessionData.expiresAt);
    if (now > expiresAt) {
      // Clean up expired session
      await kv.delete(`session:${sessionToken}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Session verification error:', error);
    return false;
  }
}