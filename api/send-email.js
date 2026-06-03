export default async function handler(req, res) {
  console.log("🔥 HIT");

  return res.status(200).json({
    ok: true
  });
}
