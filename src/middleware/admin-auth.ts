import type { APIRoute } from 'astro';

interface Session {
  token: string;
  createdAt: string;
  expiresAt: string;
  ip?: string;
  userAgent?: string;
}

/**
 * Verify admin session from cookies
 */
export async function verifyAdminSession(request: Request, locals: any): Promise<boolean> {
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

/**
 * Middleware wrapper for admin-protected API routes
 */
export function withAdminAuth(handler: APIRoute): APIRoute {
  return async (context) => {
    const { request, locals } = context;
    
    // Verify admin session
    const isAuthenticated = await verifyAdminSession(request, locals);
    if (!isAuthenticated) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Unauthorized - Admin access required'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Call the original handler if authenticated
    return handler(context);
  };
}

/**
 * Create unauthorized response
 */
export function createUnauthorizedResponse() {
  return new Response(JSON.stringify({
    success: false,
    message: 'Unauthorized - Admin access required'
  }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  });
}