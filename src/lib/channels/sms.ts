function getConfig() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) throw new Error("Twilio credentials not set");
  return { accountSid: sid, authToken: token, fromNumber: from };
}

function formatPhoneToE164(phone: string): string {
  const digits = phone.replace(/[\s\-()]/g, "");
  if (digits.startsWith("+81")) return digits;
  if (digits.startsWith("0") && digits.length >= 10) return "+81" + digits.substring(1);
  return digits.startsWith("+") ? digits : `+${digits}`;
}

export async function sendSms(to: string, body: string) {
  const config = getConfig();
  if (body.length > 660) throw new Error("SMSは660文字以内にしてください");
  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${config.accountSid}:${config.authToken}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: formatPhoneToE164(to), From: config.fromNumber, Body: body }).toString(),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(`Twilio: ${res.status} ${JSON.stringify(e)}`); }
  const result = await res.json();
  return { sid: result.sid, status: result.status, to: result.to };
}
