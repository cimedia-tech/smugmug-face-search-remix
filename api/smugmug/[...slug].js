import OAuth from "oauth-1.0a";
import CryptoJS from "crypto-js";
import axios from "axios";

const DEFAULT_SMUGMUG_API_KEY = (process.env.SMUGMUG_API_KEY || "").trim();
const DEFAULT_SMUGMUG_API_SECRET = (process.env.SMUGMUG_API_SECRET || "").trim();

const getOauth = (apiKey, apiSecret) => {
  return new OAuth({
    consumer: {
      key: apiKey || DEFAULT_SMUGMUG_API_KEY,
      secret: apiSecret || DEFAULT_SMUGMUG_API_SECRET,
    },
    signature_method: "HMAC-SHA1",
    hash_function(base_string, key) {
      return CryptoJS.HmacSHA1(base_string, key).toString(CryptoJS.enc.Base64);
    },
  });
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-smugmug-api-key, x-smugmug-api-secret, x-smugmug-access-token, x-smugmug-access-token-secret");

  if (req.method === "OPTIONS") return res.status(200).end();

  const access_token = req.headers["x-smugmug-access-token"] || req.query.access_token;
  const access_token_secret = req.headers["x-smugmug-access-token-secret"] || req.query.access_token_secret;

  const rawApiKey = (req.headers["x-smugmug-api-key"] || req.query.apiKey || DEFAULT_SMUGMUG_API_KEY || "").toString().trim();
  const rawApiSecret = (req.headers["x-smugmug-api-secret"] || req.query.apiSecret || DEFAULT_SMUGMUG_API_SECRET || "").toString().trim();
  const apiKey = (rawApiKey === "undefined" || rawApiKey === "null") ? "" : rawApiKey;
  const apiSecret = (rawApiSecret === "undefined" || rawApiSecret === "null") ? "" : rawApiSecret;

  if (!access_token || !access_token_secret) {
    return res.status(401).json({ error: "Not authenticated with SmugMug." });
  }

  const oauth = getOauth(apiKey, apiSecret);

  // Extract path after /api/smugmug/
  const { slug } = req.query;
  const apiPath = Array.isArray(slug) ? slug.join("/") : (slug || "");
  const cleanPath = apiPath.replace(/^(\/?)(api\/v2\/)/, "").replace(/^\//, "");
  const separator = cleanPath.startsWith("!") ? "" : "/";
  const baseUrl = `https://api.smugmug.com/api/v2${separator}${cleanPath}`;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (!["slug", "access_token", "access_token_secret", "apiKey", "apiSecret", "_accept"].includes(key)) {
      params.append(key, value);
    }
  }
  params.set("_accept", "json");

  const queryString = params.toString();
  const fullUrl = `${baseUrl}${queryString ? "?" + queryString : ""}`;

  const request_data = { url: fullUrl, method: "GET" };
  const token = { key: access_token, secret: access_token_secret };

  try {
    console.log(`Proxying SmugMug request to: ${fullUrl}`);
    const response = await axios.get(fullUrl, {
      headers: {
        ...oauth.toHeader(oauth.authorize(request_data, token)),
        Accept: "application/json",
        "User-Agent": "SmugMugFaceSearch/1.0",
      },
    });
    res.json(response.data);
  } catch (error) {
    console.error("SmugMug API Error:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    const errorData = error.response?.data || { error: "SmugMug API request failed." };
    res.status(status).json({ ...errorData, url: fullUrl, proxyError: error.message });
  }
}
