# Double Opt-in Email System

This newsletter system now includes a comprehensive double opt-in implementation with support for multiple email providers.

## 🚀 Features

- **Double Opt-in Confirmation**: Users must confirm their email before being added to the newsletter
- **Multi-Provider Support**: Choose from Resend, AWS SES, Postmark, SendGrid, or Mailgun
- **Token Expiration**: Confirmation links expire after 24 hours
- **Resend Functionality**: Users can request new confirmation emails
- **Welcome Emails**: Automatic welcome emails after confirmation
- **Admin Dashboard**: View pending and confirmed subscriptions

## 📧 Supported Email Providers

### 1. Resend (Default)
```bash
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_api_key_here
FROM_EMAIL=noreply@yourdomain.com
```

### 2. AWS SES
```bash
EMAIL_PROVIDER=aws-ses
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
FROM_EMAIL=noreply@yourdomain.com
```

### 3. Postmark
```bash
EMAIL_PROVIDER=postmark
POSTMARK_SERVER_TOKEN=your_server_token
FROM_EMAIL=noreply@yourdomain.com
```

### 4. SendGrid
```bash
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=SG.your_api_key
FROM_EMAIL=noreply@yourdomain.com
```

### 5. Mailgun
```bash
EMAIL_PROVIDER=mailgun
MAILGUN_API_KEY=your_api_key
MAILGUN_DOMAIN=mg.yourdomain.com
FROM_EMAIL=noreply@yourdomain.com
```

## ⚙️ Configuration

Update your `wrangler.toml` or environment variables:

```toml
vars = {
  # Required
  EMAIL_PROVIDER = "resend"
  FROM_EMAIL = "noreply@yourdomain.com"
  SITE_URL = "https://yourdomain.com"
  SITE_NAME = "Your Newsletter"
  
  # Provider-specific (choose one)
  RESEND_API_KEY = "re_your_api_key_here"
  # OR
  # AWS_ACCESS_KEY_ID = "AKIA..."
  # AWS_SECRET_ACCESS_KEY = "your_secret_key"
  # AWS_REGION = "us-east-1"
}
```

## 🔄 Subscription Flow

1. **User subscribes** → Status: `pending`
2. **Confirmation email sent** with unique token
3. **User clicks confirmation link** → `/confirm?token=xxx`
4. **Email confirmed** → Status: `active`
5. **Welcome email sent** (optional)
6. **Subscriber count updated**

## 🛠️ API Endpoints

### Subscribe
```
POST /api/public/subscribe
Content-Type: application/x-www-form-urlencoded

email=user@example.com
```

**Responses:**
- New subscription: "Please check your email to confirm your subscription! 📧"
- Already active: "This email is already subscribed to our newsletter"
- Already pending: "Confirmation email has been resent. Please check your inbox."
- Previously unsubscribed: "Welcome back! Please check your email to confirm your subscription."

### Confirm Subscription
```
GET /api/public/confirm?token=xxx
```

**Responses:**
- Success: Email confirmed, welcome email sent
- Invalid token: "Invalid or expired confirmation token"
- Already confirmed: "Email address already confirmed"
- Expired: "Confirmation token has expired. Please subscribe again."

### Resend Confirmation
```
POST /api/public/confirm
Content-Type: application/x-www-form-urlencoded

email=user@example.com
```

## 📊 Database Schema

The `Subscriber` interface now includes:

```typescript
interface Subscriber {
  email: string;
  subscribedAt: string;
  status: "pending" | "active" | "unsubscribed";
  confirmationToken?: string;
  tokenExpiresAt?: string;
  confirmedAt?: string;
  userAgent?: string;
  ip?: string;
}
```

## 🎨 User Experience

### Confirmation Page (`/confirm`)
- Automatic token validation
- Success/error states
- Resend functionality for failed confirmations
- Responsive design

### Email Templates
- Professional HTML templates
- Mobile-responsive
- Clear call-to-action buttons
- Branded with your site name

## 🔧 Development

### Testing Different Providers

1. Update `EMAIL_PROVIDER` in `wrangler.toml`
2. Add the required API keys for your chosen provider
3. Restart the development server

### Local Development

```bash
npm run dev
```

The system will use the configured email provider for sending confirmation and welcome emails.

## 🛡️ Security Features

- **Secure token generation** using `crypto.randomUUID()`
- **Token expiration** prevents indefinite pending subscriptions
- **Rate limiting** via email provider limits
- **Email validation** prevents invalid addresses
- **GDPR compliance** with explicit opt-in

## 📝 Migration from Single Opt-in

Existing subscribers remain unaffected. New subscriptions will use the double opt-in flow. To migrate existing subscribers:

1. All existing `active` subscribers remain active
2. New subscriptions get `pending` status until confirmed
3. Admin bulk uploads are marked as `active` (bypassing confirmation)

## 🚨 Troubleshooting

### Email not sending
1. Check your email provider API keys
2. Verify the `FROM_EMAIL` is authorized
3. Check console logs for specific error messages

### Confirmation links not working
1. Ensure `SITE_URL` is correctly set
2. Check that the token hasn't expired (24 hours)
3. Verify the KV namespace is accessible

### Provider-specific issues
- **AWS SES**: Ensure sending domain is verified
- **Resend**: Check domain verification
- **Postmark**: Verify server configuration
- **SendGrid**: Ensure sender identity is verified
- **Mailgun**: Check domain DNS settings