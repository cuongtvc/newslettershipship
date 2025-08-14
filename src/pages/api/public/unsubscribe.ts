import type { APIRoute } from "astro";
import type { Subscriber } from "../../../lib/email/types.js";
import {
  createJsonResponse,
  validateKVAccess,
} from "../../../lib/api-utils.js";

async function findSubscriberByUnsubscribeToken(
  kv: any,
  token: string
): Promise<{ subscriber: Subscriber | null; email: string | null }> {
  const allKeys = await kv.list({ prefix: "subscriber:" });
  
  for (const key of allKeys.keys) {
    const subscriber = (await kv.get(key.name, "json")) as Subscriber | null;
    if (subscriber?.unsubscribeToken === token) {
      const email = key.name.replace("subscriber:", "");
      return { subscriber, email };
    }
  }
  
  return { subscriber: null, email: null };
}

export const GET: APIRoute = async ({ request, locals, url }) => {
  try {
    const token = url.searchParams.get("token");
    if (!token) {
      return createJsonResponse(
        {
          success: false,
          message: "Unsubscribe token is required",
        },
        400
      );
    }

    const kv = locals.runtime?.env?.NEWSLETTER_KV;
    const kvError = validateKVAccess(kv);
    if (kvError) return kvError;

    const { subscriber, email } = await findSubscriberByUnsubscribeToken(kv, token);
    
    if (!subscriber || !email) {
      return createJsonResponse(
        {
          success: false,
          message: "Invalid or expired unsubscribe token",
        },
        404
      );
    }

    if (subscriber.status === "unsubscribed") {
      return createJsonResponse(
        {
          success: true,
          message: "Email address is already unsubscribed",
          email: email,
        },
        200
      );
    }

    // Mark as unsubscribed
    subscriber.status = "unsubscribed";
    // Remove the unsubscribe token after use
    delete subscriber.unsubscribeToken;
    
    await kv.put(`subscriber:${email}`, JSON.stringify(subscriber));

    // Decrease subscriber count if they were active
    if (subscriber.status !== "pending") {
      const currentCount = await kv.get("subscriber_count") || "0";
      const newCount = Math.max(0, parseInt(currentCount) - 1);
      await kv.put("subscriber_count", newCount.toString());
    }

    console.log("Unsubscribed successfully:", email);
    return createJsonResponse(
      {
        success: true,
        message: "Successfully unsubscribed from newsletter",
        email: email,
      },
      200
    );
  } catch (error) {
    console.error("Unsubscribe error:", error);
    return createJsonResponse(
      {
        success: false,
        message: "Unsubscribe failed. Please try again.",
      },
      500
    );
  }
};