export default async function handler(req, res) {
  console.log("🔥 FUNCTION HIT");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { to_name, to_email, score_summary } = req.body;

  if (!to_name || !to_email || !score_summary) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Step 1: Generate email body via Anthropic
  let emailBody = "";
  try {
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: `You are writing a warm, direct, personal email on behalf of Maren Frerichs from Aronga (aronga.nz) — a strategic advisor and leadership coach for senior leaders and boards in the not-for-profit sector in Aotearoa New Zealand.

The recipient (${to_name}) has just completed Aronga's Strategic Orientation Diagnostic — a self-assessment mapping their organisation's readiness across five areas of the Strategy & Direction Sprint.

Their scores:
${score_summary}

Write a personalised email that:
1. Opens with "Kia ora ${to_name}" — not "Hi" or "Dear"
2. Acknowledges what they've just reflected on — warmly and directly
3. Names where they appear to be grounded/strong (if applicable) — use language like "what's holding well", "what's going steady"
4. Names honestly where the pressure is showing — "where direction may be drifting", "where the work is", "what wants attention." Be honest but not alarming.
5. Includes a short paragraph on the ways Aronga can help, introduced naturally — not as a list of products but as an offer of support. Mention these three options in plain language: one-on-one coaching for leaders working on their own strategic thinking; strategy sessions focused on a particular area they want to strengthen; facilitated workshops to build or reset strategy with their team.
6. Closes with an invitation to a 20-minute conversation — framed as: this is where it gets interesting. Not a sales pitch.
7. Signs off as Maren

Tone: warm, grounded, direct. Not consultancy language. Not cheerful. Like someone who has been doing this work for a long time and can see what is happening clearly. Use plain language. Short sentences. No bullet points.

Do NOT use the word "journey". Do NOT say "I hope this finds you well." Keep it under 350 words.`
        }]
      })
    });

    const aiData = await aiResponse.json();
    emailBody = aiData?.content?.[0]?.text || "";
  } catch (err) {
    console.error("Anthropic error:", err.message);
    emailBody = `Kia ora ${to_name},\n\nThank you for completing the Strategic Orientation Diagnostic. Your results are attached below.\n\nI'll be in touch to arrange our 20-minute conversation.\n\nMaren\n\naronga.nz`;
  }

  // Step 2: Send via Resend
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Maren at Aronga <maren@aronga.nz>",
        to: [to_email],
        bcc: ["maren@aronga.nz"],
        subject: "Your Strategic Orientation Diagnostic — Aronga",
        text: `${emailBody}\n\n---\nScore summary:\n${score_summary}`,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("Resend error:", JSON.stringify(data));
      return res.status(400).json({ error: "Email send failed", detail: data });
    }
    return res.status(200).json({ success: true, emailBody });
  } catch (err) {
    console.error("Resend error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
