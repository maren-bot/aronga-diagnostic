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
  // 1. CLAUDE (INTERPRETATION LAYER)
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
        temperature: 0.7,
        messages: [
          {
            role: "user",
            content: `
You are Maren Frerichs from Aronga (Aotearoa New Zealand).

You interpret leadership diagnostics through a framework called Strategic Orientation in Motion:
- Leadership is about staying oriented in shifting conditions, not reporting on fixed plans
- The purpose is insight, not summarisation
- You must interpret patterns across identity, purpose, choices, capability, and rhythm

DO NOT repeat scores mechanically.
DO NOT present this as a report.

You are writing a strategic reflection email.

Recipient: ${to_name}

Scores:
${score_summary}

WRITE AN EMAIL THAT:

1. Opens with: "Kia ora ${to_name}"

2. First paragraph:
Describe the *overall pattern* of how this leader is operating under pressure (not a summary of categories)

3. Second paragraph:
Name 2–3 strengths using natural language like:
- “this is holding steady”
- “this is working well under load”
- “there is strong grounding here”

4. Third paragraph:
Name 2–3 pressure points using calm language:
- “strain is showing here”
- “attention is needed here”
- “there are early signs of drift”

5. Fourth paragraph:
Interpret what this means for decision-making under uncertainty and leadership clarity

6. Fifth paragraph:
Naturally weave in Aronga support:
(coaching, strategy sessions, workshops)
Do NOT list them. Integrate them as options that might be useful.

7. Final paragraph:
Invite a 20-minute conversation framed as clarity under pressure

STYLE RULES:
- Warm, grounded, direct
- No corporate language
- No clichés
- No motivational tone
- No “journey”
- No “hope you’re well”
- Short paragraphs
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

    console.log("ANTHROPIC RAW RESPONSE:", JSON.stringify(aiData, null, 2));

    emailBody = aiData?.content?.[0]?.text || "";

    if (!emailBody || emailBody.length < 50) {
      throw new Error("Invalid or empty AI response");
    }

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
  // 2. SEND EMAIL (CLIENT)
  // =========================
  let resendClientResult;

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

    resendClientResult = await response.json();

    if (!response.ok) {
      console.error("Resend client error:", resendClientResult);
      return res.status(400).json({
        error: "Client email failed",
        detail: resendClientResult,
      });
    }

  } catch (err) {
    console.error("CLIENT EMAIL ERROR:", err);
    return res.status(500).json({ error: err.message });
  }

  // =========================
  // 3. INTERNAL COPY (ALWAYS SENT)
  // =========================
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Aronga <maren@aronga.nz>",
        to: ["maren@aronga.nz"],
        subject: `Diagnostic Submission — ${to_name}`,
        text: `
NEW DIAGNOSTIC SUBMISSION

Name: ${to_name}
Email: ${to_email}

----------------------

${emailBody}
        `.trim(),
      }),
    });

  } catch (err) {
    console.error("INTERNAL COPY FAILED:", err);
    // do NOT fail main request if internal copy fails
  }

  return res.status(200).json({
    success: true,
    emailBody,
    resend: resendClientResult,
  });
}
