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
        content: `Write a short email based on:
${score_summary}`
      }]
    })
  });

  const aiData = await aiResponse.json();

  console.log("CLAUDE RESPONSE:", aiData);

  if (!aiResponse.ok) {
    console.log("Claude API error:", aiData);
    throw new Error("Claude request failed");
  }

  emailBody =
    aiData?.content?.[0]?.text ||
    "Thanks for completing the diagnostic. We’ll be in touch shortly.";

} catch (err) {
  console.log("Claude failed, using fallback:", err);

  emailBody = `
Thanks for completing the Aronga Strategic Orientation Diagnostic.

Here is your summary:
${score_summary}

– Maren
`;
}
