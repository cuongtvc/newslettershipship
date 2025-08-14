import type { APIRoute } from "astro";

interface Subscriber {
  email: string;
  subscribedAt: string;
  status: "active" | "unsubscribed";
  userAgent?: string;
  ip?: string;
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const formData = await request.formData();
    const email = formData.get("email")?.toString()?.toLowerCase().trim();

    // Enhanced email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Please enter a valid email address",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Access KV namespace
    const kv = locals.runtime?.env?.NEWSLETTER_KV;
    if (!kv) {
      console.error("KV namespace not available");
      return new Response(
        JSON.stringify({
          success: false,
          message: "Service temporarily unavailable",
        }),
        {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if email already exists
    const existingSubscriber = (await kv.get(
      `subscriber:${email}`,
      "json"
    )) as Subscriber | null;

    if (existingSubscriber) {
      if (existingSubscriber.status === "active") {
        return new Response(
          JSON.stringify({
            success: false,
            message: "This email is already subscribed to our newsletter",
          }),
          {
            status: 409,
            headers: { "Content-Type": "application/json" },
          }
        );
      } else {
        // Reactivate unsubscribed user
        existingSubscriber.status = "active";
        existingSubscriber.subscribedAt = new Date().toISOString();
        await kv.put(`subscriber:${email}`, JSON.stringify(existingSubscriber));

        return new Response(
          JSON.stringify({
            success: true,
            message: "Welcome back! Your subscription has been reactivated.",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Create new subscriber
    const subscriber: Subscriber = {
      email,
      subscribedAt: new Date().toISOString(),
      status: "active",
      userAgent: request.headers.get("user-agent") || undefined,
      ip: request.headers.get("cf-connecting-ip") || undefined,
    };

    // Store subscriber in KV
    await kv.put(`subscriber:${email}`, JSON.stringify(subscriber));

    // Add to subscriber count (for analytics)
    const currentCount = (await kv.get("subscriber_count")) || "0";
    await kv.put("subscriber_count", (parseInt(currentCount) + 1).toString());

    console.log("New subscription:", email);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Successfully subscribed to newsletter! 🎉",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Subscription error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Subscription failed. Please try again.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
