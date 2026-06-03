export default async function handler(req, res) {
  console.log("🔥 FUNCTION HIT");

  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

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
        model: "claude-3-5-sonnet-latest",
        max_tokens: 900,
        messages: [
          {
            role: "user",
            content: `
You are Maren Frerichs writing a strategic reflection email.

Recipient: ${to_name}

Scores:
${score_summary}

Write:
- Kia ora ${to_name} opening
- pattern insight (not summary)
- strengths (2–3)
- pressure points (2–3)
- meaning under leadership pressure
- mention coaching / strategy sessions / workshops naturally
- invite 20-minute clarity conversation

STYLE:
- warm, grounded, direct
- no corporate tone
- no clichés
- no "journey"
- no "hope you're well"
- under 350 words

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

    if (!emailBody) throw new Error("Empty AI response");
  } catch (err) {
    console.error("AI GENERATION FAILED:", err);

    emailBody = `Kia ora ${to_name},

Thanks for completing the Strategic Orientation Diagnostic.

Your results:
${score_summary}

Ngā mihi  
Maren Frerichs  
Aronga`;
  }

  // =========================
  // 2. SEND EMAIL TO CLIENT
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
        subject: "Your Strategic Orientation Diagnostic — Aronga",
        text: emailBody,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Resend error:", data);
      return res.status(400).json({ error: "Email send failed", detail: data });
    }

    // =========================
    // 3. INTERNAL COPY (ALWAYS)
    // =========================
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Aronga <maren@aronga.nz>",
        to: ["maren@aronga.nz"],
        subject: `Diagnostic: ${to_name} (${to_email})`,
        text: `
NEW DIAGNOSTIC SUBMISSION

Name: ${to_name}
Email: ${to_email}

----------------------

${emailBody}
        `.trim(),
      }),
    });

    return res.status(200).json({
      success: true,
      emailBody,
    });
  } catch (err) {
    console.error("SEND ERROR:", err);

    return res.status(500).json({
      error: err.message,
    });
  }
}
