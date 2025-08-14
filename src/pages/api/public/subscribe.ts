import type { APIRoute } from "astro";
import type { Subscriber } from "../../../lib/email/types.js";
import { EmailService, generateConfirmationToken, getTokenExpirationDate } from "../../../lib/email/service.js";

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
      } else if (existingSubscriber.status === "pending") {
        // Resend confirmation email for pending subscriptions
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
      } else {
        // Reactivate unsubscribed user with new confirmation
        const confirmationToken = generateConfirmationToken();
        const tokenExpiresAt = getTokenExpirationDate();
        
        existingSubscriber.status = "pending";
        existingSubscriber.subscribedAt = new Date().toISOString();
        existingSubscriber.confirmationToken = confirmationToken;
        existingSubscriber.tokenExpiresAt = tokenExpiresAt;
        delete existingSubscriber.confirmedAt;
        
        await kv.put(`subscriber:${email}`, JSON.stringify(existingSubscriber));

        try {
          const emailService = new EmailService(locals.runtime.env);
          const result = await emailService.sendConfirmationEmail(email, confirmationToken);
          
          if (!result.success) {
            console.error(`Failed to send confirmation email (${result.provider}):`, result.error);
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
              message: "Welcome back! Please check your email to confirm your subscription.",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          );
        } catch (error) {
          console.error("Error sending confirmation email:", error);
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
      }
    }

    // Create new subscriber with pending status
    const confirmationToken = generateConfirmationToken();
    const tokenExpiresAt = getTokenExpirationDate();
    
    const subscriber: Subscriber = {
      email,
      subscribedAt: new Date().toISOString(),
      status: "pending",
      confirmationToken,
      tokenExpiresAt,
      userAgent: request.headers.get("user-agent") || undefined,
      ip: request.headers.get("cf-connecting-ip") || undefined,
    };

    // Store subscriber in KV
    await kv.put(`subscriber:${email}`, JSON.stringify(subscriber));

    // Send confirmation email
    try {
      const emailService = new EmailService(locals.runtime.env);
      const result = await emailService.sendConfirmationEmail(email, confirmationToken);
      
      if (!result.success) {
        console.error(`Failed to send confirmation email (${result.provider}):`, result.error);
        // Clean up the pending subscriber since we couldn't send the email
        await kv.delete(`subscriber:${email}`);
        
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

      console.log("New subscription pending confirmation:", email);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Please check your email to confirm your subscription! 📧",
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    } catch (error) {
      console.error("Error sending confirmation email:", error);
      // Clean up the pending subscriber since we couldn't send the email
      await kv.delete(`subscriber:${email}`);
      
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
