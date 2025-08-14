import type { APIRoute } from "astro";
import type { Subscriber } from "../../../lib/email/types.js";
import { EmailService, isTokenExpired } from "../../../lib/email/service.js";

export const GET: APIRoute = async ({ request, locals, url }) => {
  try {
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Confirmation token is required",
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

    // Find subscriber by token
    const allKeys = await kv.list({ prefix: 'subscriber:' });
    let targetSubscriber: Subscriber | null = null;
    let targetEmail: string | null = null;

    for (const key of allKeys.keys) {
      const subscriber = await kv.get(key.name, 'json') as Subscriber;
      if (subscriber && subscriber.confirmationToken === token) {
        targetSubscriber = subscriber;
        targetEmail = subscriber.email;
        break;
      }
    }

    if (!targetSubscriber || !targetEmail) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Invalid or expired confirmation token",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if already confirmed
    if (targetSubscriber.status === "active") {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Email address already confirmed",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if token is expired
    if (targetSubscriber.tokenExpiresAt && isTokenExpired(targetSubscriber.tokenExpiresAt)) {
      // Clean up expired token
      await kv.delete(`subscriber:${targetEmail}`);
      
      return new Response(
        JSON.stringify({
          success: false,
          message: "Confirmation token has expired. Please subscribe again.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Confirm subscription
    targetSubscriber.status = "active";
    targetSubscriber.confirmedAt = new Date().toISOString();
    // Clean up confirmation fields
    delete targetSubscriber.confirmationToken;
    delete targetSubscriber.tokenExpiresAt;

    // Update subscriber in KV
    await kv.put(`subscriber:${targetEmail}`, JSON.stringify(targetSubscriber));

    // Update subscriber count
    const currentCount = (await kv.get("subscriber_count")) || "0";
    await kv.put("subscriber_count", (parseInt(currentCount) + 1).toString());

    // Send welcome email
    try {
      const emailService = new EmailService(locals.runtime.env);
      const result = await emailService.sendWelcomeEmail(targetEmail);
      
      if (!result.success) {
        console.error(`Failed to send welcome email (${result.provider}):`, result.error);
        // Don't fail the confirmation if welcome email fails
      }
    } catch (error) {
      console.error("Error sending welcome email:", error);
      // Don't fail the confirmation if welcome email fails
    }

    console.log("Subscription confirmed:", targetEmail);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email confirmed successfully! Welcome to our newsletter! 🎉",
        email: targetEmail,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Confirmation error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Confirmation failed. Please try again.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const formData = await request.formData();
    const email = formData.get("email")?.toString()?.toLowerCase().trim();

    if (!email) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Email address is required",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Enhanced email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
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

    // Check if subscriber exists and is pending
    const existingSubscriber = (await kv.get(
      `subscriber:${email}`,
      "json"
    )) as Subscriber | null;

    if (!existingSubscriber || existingSubscriber.status !== "pending") {
      return new Response(
        JSON.stringify({
          success: false,
          message: "No pending subscription found for this email address",
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Check if token is expired
    if (existingSubscriber.tokenExpiresAt && isTokenExpired(existingSubscriber.tokenExpiresAt)) {
      // Clean up expired subscription
      await kv.delete(`subscriber:${email}`);
      
      return new Response(
        JSON.stringify({
          success: false,
          message: "Confirmation has expired. Please subscribe again.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Resend confirmation email
    try {
      const emailService = new EmailService(locals.runtime.env);
      const result = await emailService.sendConfirmationEmail(email, existingSubscriber.confirmationToken!);
      
      if (!result.success) {
        console.error(`Failed to resend confirmation email (${result.provider}):`, result.error);
        return new Response(
          JSON.stringify({
            success: false,
            message: "Failed to send confirmation email. Please try again.",
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: "Confirmation email has been resent. Please check your inbox.",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error resending confirmation email:", error);
      return new Response(
        JSON.stringify({
          success: false,
          message: "Failed to send confirmation email. Please try again.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }
  } catch (error) {
    console.error("Resend confirmation error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        message: "Request failed. Please try again.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};