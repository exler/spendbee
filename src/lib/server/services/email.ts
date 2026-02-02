import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { env } from "$env/dynamic/private";

interface EmailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
}

class EmailService {
    private transporter: Transporter | null = null;
    private isConfigured = false;

    constructor() {
        this.initialize();
    }

    private initialize() {
        const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD, SMTP_FROM_EMAIL } = env;

        // Check if all required SMTP configuration is present
        if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASSWORD || !SMTP_FROM_EMAIL) {
            console.warn("SMTP configuration is incomplete. Email sending is disabled.");
            this.isConfigured = false;
            return;
        }

        try {
            this.transporter = nodemailer.createTransport({
                host: SMTP_HOST,
                port: Number.parseInt(SMTP_PORT),
                secure: SMTP_SECURE === "true", // true for 465, false for other ports
                auth: {
                    user: SMTP_USER,
                    pass: SMTP_PASSWORD,
                },
            });

            this.isConfigured = true;
            console.log("Email service initialized successfully");
        } catch (error) {
            console.error("Failed to initialize email service:", error);
            this.isConfigured = false;
        }
    }

    /**
     * Send an email
     */
    async sendEmail({ to, subject, html, text }: EmailOptions): Promise<boolean> {
        if (!this.isConfigured || !this.transporter) {
            console.warn("Email service is not configured. Skipping email send.");
            return false;
        }

        const { SMTP_FROM_EMAIL, SMTP_FROM_NAME } = env;

        try {
            const info = await this.transporter.sendMail({
                from: `"${SMTP_FROM_NAME}" <${SMTP_FROM_EMAIL}>`,
                to,
                subject,
                text: text || this.stripHtml(html), // Fallback to stripped HTML if no text provided
                html,
            });

            console.log("Email sent successfully:", info.messageId);
            return true;
        } catch (error) {
            console.error("Failed to send email:", error);
            return false;
        }
    }

    /**
     * Send a group invitation email
     */
    async sendGroupInvitation({
        to,
        inviterName,
        groupName,
        acceptUrl,
        isNewUser = false,
    }: {
        to: string;
        inviterName: string;
        groupName: string;
        acceptUrl: string;
        isNewUser?: boolean;
    }): Promise<boolean> {
        const subject = `You've been invited to join ${groupName}`;

        const html = isNewUser
            ? this.getNewUserInvitationEmailTemplate({
                  inviterName,
                  groupName,
                  acceptUrl,
                  recipientEmail: to,
              })
            : this.getExistingUserInvitationEmailTemplate({
                  inviterName,
                  groupName,
                  acceptUrl,
                  recipientEmail: to,
              });

        return this.sendEmail({ to, subject, html });
    }

    /**
     * Generate HTML template for new user group invitation email
     */
    private getNewUserInvitationEmailTemplate({
        inviterName,
        groupName,
        acceptUrl,
        recipientEmail,
    }: {
        inviterName: string;
        groupName: string;
        acceptUrl: string;
        recipientEmail: string;
    }): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Group Invitation</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #e5e7eb;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(to bottom, #2C2D30, #3A3B40);
        }
        .container {
            background-color: #2C2D30;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        }
        .logo {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo-img {
            width: 100px;
            height: 100px;
            margin: 0 auto 16px;
        }
        .logo h1 {
            color: #FFC700;
            margin: 0;
            font-size: 32px;
            font-weight: 600;
        }
        .content {
            margin-bottom: 30px;
        }
        .content h2 {
            color: #ffffff;
            margin-top: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content p {
            color: #d1d5db;
            margin: 15px 0;
        }
        .group-name {
            font-weight: 700;
            color: #FFC700;
        }
        .button-container {
            text-align: center;
            margin: 30px 0;
        }
        .button {
            display: inline-block;
            padding: 14px 32px;
            background-color: #FFC700;
            color: #2C2D30 !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            transition: background-color 0.3s;
        }
        .button:hover {
            background-color: #FFD966;
        }
        .footer {
            text-align: center;
            color: #9ca3af;
            font-size: 14px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #4A4B50;
        }
        .alternative-link {
            margin-top: 20px;
            padding: 15px;
            background-color: #1A1B1E;
            border: 1px solid #4A4B50;
            border-radius: 8px;
            font-size: 12px;
            color: #9ca3af;
            word-break: break-all;
        }
        .highlight-box {
            background-color: #3A3B40;
            border-left: 4px solid #FFC700;
            padding: 16px;
            margin: 20px 0;
            border-radius: 8px;
        }
        .highlight-box strong {
            color: #ffffff;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <h1>Spendbee</h1>
        </div>

        <div class="content">
            <h2>You've been invited to join Spendbee!</h2>
            <p>
                <strong style="color: #ffffff;">${inviterName}</strong> has invited you to join the group
                <span class="group-name">${groupName}</span> on Spendbee.
            </p>

            <div class="highlight-box">
                <p style="margin: 0;">
                    <strong>📝 First, you'll need to create an account</strong>
                </p>
                <p style="margin: 10px 0 0 0; color: #d1d5db;">
                    Don't worry, it only takes a minute! After creating your account,
                    you'll automatically join the group and can start tracking expenses together.
                </p>
            </div>

            <p>
                Spendbee helps you track shared expenses and manage group finances effortlessly.
                Perfect for roommates, trips, couples, and any shared expenses!
            </p>
        </div>

        <div class="button-container">
            <a href="${acceptUrl}" class="button">Create Account & Join Group</a>
        </div>

        <div class="alternative-link">
            <p style="margin: 0 0 10px 0; color: #d1d5db;">
                If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="margin: 0; color: #9ca3af;">${acceptUrl}</p>
        </div>

        <div class="footer">
            <p>
                This invitation was sent to <span style="color: #d1d5db;">${recipientEmail}</span>. If you weren't expecting this invitation,
                you can safely ignore this email.
            </p>
            <p style="margin-top: 10px; color: #6b7280;">
                © ${new Date().getFullYear()} Spendbee. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>
		`.trim();
    }

    /**
     * Generate HTML template for existing user group invitation email
     */
    private getExistingUserInvitationEmailTemplate({
        inviterName,
        groupName,
        acceptUrl,
        recipientEmail,
    }: {
        inviterName: string;
        groupName: string;
        acceptUrl: string;
        recipientEmail: string;
    }): string {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Group Invitation</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #e5e7eb;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background: linear-gradient(to bottom, #2C2D30, #3A3B40);
        }
        .container {
            background-color: #2C2D30;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        }
        .logo {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo-img {
            width: 100px;
            height: 100px;
            margin: 0 auto 16px;
        }
        .logo h1 {
            color: #FFC700;
            margin: 0;
            font-size: 32px;
            font-weight: 600;
        }
        .content {
            margin-bottom: 30px;
        }
        .content h2 {
            color: #ffffff;
            margin-top: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .content p {
            color: #d1d5db;
            margin: 15px 0;
        }
        .group-name {
            font-weight: 700;
            color: #FFC700;
        }
        .button-container {
            text-align: center;
            margin: 30px 0;
        }
        .button {
            display: inline-block;
            padding: 14px 32px;
            background-color: #FFC700;
            color: #2C2D30 !important;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            transition: background-color 0.3s;
        }
        .button:hover {
            background-color: #FFD966;
        }
        .footer {
            text-align: center;
            color: #9ca3af;
            font-size: 14px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #4A4B50;
        }
        .alternative-link {
            margin-top: 20px;
            padding: 15px;
            background-color: #1A1B1E;
            border: 1px solid #4A4B50;
            border-radius: 8px;
            font-size: 12px;
            color: #9ca3af;
            word-break: break-all;
        }
        .info-box {
            background-color: #3A3B40;
            border-left: 4px solid #FFC700;
            padding: 16px;
            margin: 20px 0;
            border-radius: 8px;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">
            <h1>Spendbee</h1>
        </div>

        <div class="content">
            <h2>You've been invited!</h2>
            <p>
                <strong style="color: #ffffff;">${inviterName}</strong> has invited you to join the group
                <span class="group-name">${groupName}</span> on Spendbee.
            </p>

            <div class="info-box">
                <p style="margin: 0; color: #ffffff;">
                    <strong>✨ Start tracking expenses together</strong>
                </p>
                <p style="margin: 10px 0 0 0; color: #d1d5db;">
                    Join the group to collaborate on shared expenses, view balances, and settle debts easily.
                </p>
            </div>

            <p>
                Spendbee helps you track shared expenses and manage group finances effortlessly.
                Perfect for roommates, trips, couples, and any shared expenses!
            </p>
        </div>

        <div class="button-container">
            <a href="${acceptUrl}" class="button">Accept Invitation</a>
        </div>

        <div class="alternative-link">
            <p style="margin: 0 0 10px 0; color: #d1d5db;">
                If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="margin: 0; color: #9ca3af;">${acceptUrl}</p>
        </div>

        <div class="footer">
            <p>
                This invitation was sent to <span style="color: #d1d5db;">${recipientEmail}</span>. If you weren't expecting this invitation,
                you can safely ignore this email.
            </p>
            <p style="margin-top: 10px; color: #6b7280;">
                © ${new Date().getFullYear()} Spendbee. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>
		`.trim();
    }

    /**
     * Strip HTML tags from a string for plain text fallback
     */
    private stripHtml(html: string): string {
        return html
            .replace(/<style[^>]*>.*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, "")
            .replace(/\s+/g, " ")
            .trim();
    }

    /**
     * Verify SMTP connection
     */
    async verifyConnection(): Promise<boolean> {
        if (!this.isConfigured || !this.transporter) {
            return false;
        }

        try {
            await this.transporter.verify();
            console.log("SMTP connection verified successfully");
            return true;
        } catch (error) {
            console.error("SMTP connection verification failed:", error);
            return false;
        }
    }
}

// Export singleton instance
export const emailService = new EmailService();
