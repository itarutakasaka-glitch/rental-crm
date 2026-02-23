const fs = require("fs");
let c = fs.readFileSync("src/app/api/webhook/email/route.ts", "utf8");

// Replace the 3 lines
c = c.replace(
  /const bodyText = emailData\.text \|\| "";\s*const bodyHtml = emailData\.html \|\| "";\s*const body = bodyText \|\| bodyHtml \|\| "";/,
  `let body = "";
    if (emailData.email_id && process.env.RESEND_API_KEY) {
      try {
        const emailRes = await fetch(\`https://api.resend.com/emails/\${emailData.email_id}\`, {
          headers: { Authorization: \`Bearer \${process.env.RESEND_API_KEY}\` },
        });
        const emailDetail = await emailRes.json();
        body = emailDetail.text || emailDetail.html || "";
        console.log("[Email Webhook] Fetched body length:", body.length);
      } catch (e) {
        console.error("[Email Webhook] Failed to fetch email body:", e);
      }
    }`
);

fs.writeFileSync("src/app/api/webhook/email/route.ts", c, "utf8");
console.log("done");
