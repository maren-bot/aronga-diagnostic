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

  let emailBody = "";

  // =========================
  // 1. CLAUDE EMAIL GENERATION
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
        model: "claude-3-5-sonnet-latest",
        max_tokens: 900,
        messages: [
          {
            role: "user",
            content: `
You are Maren Frerichs writing a strategic reflection email for a senior leader in Aotearoa New Zealand.

They have just completed the Aronga Strategic Orientation Diagnostic.

Their scores:
${score_summary}

Write a structured but natural email with:

- Start: "Kia ora ${to_name}"
- First paragraph: overall pattern (not a summary)
- Second: 2–3 strengths ("holding steady", "working well", "strong foundations")
- Third: 2–3 pressure points ("strain showing", "attention needed", "drift forming")
- Fourth: what this means for leadership under pressure
- Fifth: mention support (coaching, strategy sessions, workshops) naturally
- Final line: invite a 20-minute conversation framed as clarity under pressure

STYLE:
- Warm, grounded, direct
- Short paragraphs
- No bullet points
- No corporate language
- No clichés
- No "journey"
- No "hope you're well"
- Under 350 words

END EXACTLY WITH:

Ngā mihi  
Maren Frerichs  
Founder & Principal | Aronga  
Strategic partner for leaders under pressure  
+64 27 446 9032  
aronga.nz  
https://nz.linkedin.com/in/marenfrerichs  
https://www.instagram.com/a.r.o.n.g.a/  
https://www.facebook.com/people/Aronga/61584111041409/  
https://wa.me/64274469032
            `.trim(),
          },
        ],
      }),
    });

    const aiData = await aiResponse.json();
    console.log("ANTHROPIC RESPONSE:", JSON.stringify(aiData, null, 2));

    emailBody = aiData?.content?.[0]?.text || "";

    if (!emailBody) {
      throw new Error("Empty email body from Anthropic");
    }

  } catch (err) {
    console.error("AI GENERATION FAILED:", err);

    emailBody = `
Kia ora ${to_name},

Thanks for completing the Strategic Orientation Diagnostic.

Your results are below:
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
        from: "Aronga <onboarding@resend.dev>", // safer default for debugging
        to: [to_email],
        bcc: ["maren@aronga.nz"],
        subject: "Your Strategic Orientation Diagnostic — Aronga",
        text: emailBody,
      }),
    });

    const data = await response.json();
    console.log("RESEND RESPONSE:", JSON.stringify(data, null, 2));

    if (!response.ok) {
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
