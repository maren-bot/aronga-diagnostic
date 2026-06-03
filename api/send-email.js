export default async function handler(req, res) {
  console.log("🔥 FUNCTION HIT");

  // =========================
  // CORS
  // =========================
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { to_name, to_email, score_summary } = req.body;

  if (!to_name || !to_email || !score_summary) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  let emailBody = "";

  // =========================
  // 1. CLAUDE GENERATION
  // =========================
  try {
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1200,
        messages: [
          {
            role: "user",
            content: `
You are an AI assistant writing a personal results email on behalf of Aronga, a leadership advisory business run by Maren Frerichs. You are writing directly to the person who just completed the Strategic Orientation Diagnostic.

Recipient: ${to_name}
Scores:
${score_summary}

Write a plain text email with the following structure. Use ALL CAPS for section headings. No markdown. No bold. No bullet points. No asterisks. Plain paragraphs only.

STRUCTURE:

Kia ora ${to_name},

Opening paragraph: One or two sentences that name the overall pattern in their scores — not a summary, a genuine observation about what the numbers reveal together. Be specific to their actual scores.

YOUR STRENGTHS

Two or three sentences naming what is genuinely working across their results. Be specific. No generic praise.

WHERE ATTENTION IS NEEDED

Two or three sentences naming where the pressure sits. Be direct and plain. No metaphors. Say what is actually happening.

WHAT THIS MEANS UNDER PRESSURE

One short paragraph explaining what this pattern tends to produce when things tighten — budget pressure, board changes, competing demands. Name the consequence plainly.

WHAT HAPPENS NEXT

Write this closing paragraph exactly as follows, adjusting only the name: "Because you've sent this to yourself, Aronga has received a copy too. Maren will be in touch within 24 hours to see whether any support would be useful, and to talk through what the options might look like."

Then end with:

Ngā mihi
Maren Frerichs
Founder & Principal | Aronga
aronga.nz

Then add a separator line of dashes, then include the full score data:

YOUR SCORES
${score_summary}

STYLE RULES:
- Plain language throughout. No corporate tone. No clichés.
- Do not use: "sharp", "rare", "journey", "connective tissue", "load-bearing", "compounds", "sharper", "hope you're well", "framework", "navigate"
- Do not say "we" as if writing from Aronga — refer to Aronga in the third person
- Do not offer or invite a conversation — Maren will make contact
- Under 400 words total, not counting the score dump
`.trim(),
          },
        ],
      }),
    });

    const aiData = await aiResponse.json();

    console.log("ANTHROPIC RESPONSE:", JSON.stringify(aiData, null, 2));

    emailBody = aiData?.content?.[0]?.text || "";

    if (!emailBody) throw new Error("Empty AI response");
  } catch (err) {
    console.error("AI GENERATION FAILED:", err);

    emailBody = `
Kia ora ${to_name},

Thanks for completing the Strategic Orientation Diagnostic.

Your results:
${score_summary}

Ngā mihi  
Maren Frerichs  
Aronga
    `.trim();
  }

  // =========================
  // 2. SEND EMAIL (RESEND)
  // =========================
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Aronga <maren@aronga.nz>",
        to: [to_email],
        bcc: ["maren@aronga.nz"],
        subject: "Your Strategic Orientation Diagnostic — Aronga",
        text: emailBody,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend error:", data);
      return res.status(400).json({
        error: "Email send failed",
        detail: data,
      });
    }

    return res.status(200).json({
      success: true,
      emailBody,
    });

  } catch (err) {
    console.error("RESEND ERROR:", err);
    return res.status(500).json({ error: err.message });
  }
}
