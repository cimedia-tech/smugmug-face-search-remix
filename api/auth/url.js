import OAuth from "oauth-1.0a";
import CryptoJS from "crypto-js";
import axios from "axios";

const DEFAULT_SMUGMUG_API_KEY = (process.env.SMUGMUG_API_KEY || "").trim();
const DEFAULT_SMUGMUG_API_SECRET = (process.env.SMUGMUG_API_SECRET || "").trim();
const APP_URL = (process.env.APP_URL || "").replace(/\/$/, "");

// In-memory store for serverless (per-invocation, short-lived)
// For production use, consider Redis/KV store for multi-instance
const oauthSecrets = new Map();

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

const getCredentials = (req) => {
  const body = req.body || {};
  const query = req.query || {};
  const headers = req.headers || {};

  const rawApiKey = (
    headers["x-smugmug-api-key"] ||
    body.apiKey ||
    query.apiKey ||
    DEFAULT_SMUGMUG_API_KEY ||
    ""
  ).toString().trim();

  const rawApiSecret = (
    headers["x-smugmug-api-secret"] ||
    body.apiSecret ||
    query.apiSecret ||
    DEFAULT_SMUGMUG_API_SECRET ||
    ""
  ).toString().trim();

  const apiKey = (rawApiKey === "undefined" || rawApiKey === "null") ? "" : rawApiKey;
  const apiSecret = (rawApiSecret === "undefined" || rawApiSecret === "null") ? "" : rawApiSecret;

  return { apiKey, apiSecret };
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-smugmug-api-key, x-smugmug-api-secret");

  if (req.method === "OPTIONS") return res.status(200).end();

  const { apiKey, apiSecret } = getCredentials(req);

  if (!apiKey || !apiSecret) {
    return res.status(400).json({
      error: "SmugMug API credentials not configured.",
      details: "Please click the Settings icon (gear) and enter your API Key and Secret.",
    });
  }

  const oauth = getOauth(apiKey, apiSecret);
  const callbackUrl = `${APP_URL}/auth/callback?apiKey=${encodeURIComponent(apiKey)}&apiSecret=${encodeURIComponent(apiSecret)}`;

  const request_data = {
    url: "https://api.smugmug.com/services/oauth/1.0a/getRequestToken",
    method: "POST",
    data: { oauth_callback: callbackUrl },
  };

  try {
    const authData = oauth.authorize(request_data);
    const body = new URLSearchParams();
    for (const key in authData) {
      body.append(key, authData[key]);
    }

    const response = await axios.post(request_data.url, body.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json, text/plain, */*",
      },
    });

    let oauth_token = "";
    let oauth_token_secret = "";

    if (typeof response.data === "string") {
      const responseParams = new URLSearchParams(response.data);
      oauth_token = responseParams.get("oauth_token") || "";
      oauth_token_secret = responseParams.get("oauth_token_secret") || "";
    } else if (typeof response.data === "object" && response.data !== null) {
      oauth_token = response.data.oauth_token || "";
      oauth_token_secret = response.data.oauth_token_secret || "";
    }

    if (!oauth_token || !oauth_token_secret) {
      throw new Error(`Failed to get tokens. Data: ${JSON.stringify(response.data)}`);
    }

    const authorizeUrl = `https://api.smugmug.com/services/oauth/1.0a/authorize?oauth_token=${oauth_token}&Access=Full&Permissions=Read`;
    res.json({ url: authorizeUrl, oauth_token, oauth_token_secret });
  } catch (error) {
    const errorData = error.response?.data || error.message;
    const errorStr = typeof errorData === "string" ? errorData : JSON.stringify(errorData);

    let userMessage = "Failed to initiate OAuth flow.";
    if (errorStr.includes("consumer_key_unknown")) {
      userMessage = `Invalid SmugMug API Key.`;
    } else if (errorStr.includes("signature_invalid")) {
      userMessage = "OAuth signature mismatch. Please verify your API Secret.";
    }

    res.status(500).json({ error: userMessage, details: errorData });
  }
}
