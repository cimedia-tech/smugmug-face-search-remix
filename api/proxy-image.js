import axios from "axios";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(200).end();

  const imageUrl = req.query.url;
  if (!imageUrl) return res.status(400).json({ error: "Missing image URL" });

  try {
    const response = await axios.get(imageUrl, { responseType: "arraybuffer" });
    const contentType = response.headers["content-type"];
    res.setHeader("Content-Type", contentType);
    res.send(response.data);
  } catch (error) {
    console.error("Image Proxy Error:", error);
    res.status(500).json({ error: "Failed to proxy image" });
  }
}
