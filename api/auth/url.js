import OAuth from "oauth-1.0a";
import CryptoJS from "crypto-js";
import axios from "axios";

const DEFAULT_SMUGMUG_API_KEY = (process.env.SMUGMUG_API_KEY || "").trim();
const DEFAULT_SMUGMUG_API_SECRET = (process.env.SMUGMUG_API_SECRET || "").trim();
const APP_URL = (process.env.APP_URL || "").replace(/\/$/, "");

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
  // If frontend passes "__server__" sentinel, use server-side secret
  const rawSecret = (rawApiSecret === "undefined" || rawApiSecret === "null" || rawApiSecret === "__server__") 
    ? DEFAULT_SMUGMUG_API_SECRET 
    : rawApiSecret;
  const apiSecret = rawSecret.toString().trim();

  return { apiKey, apiSecret };
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", APP_URL || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
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

  // Callback URL — we'll embed oauth_token_secret after we get it from SmugMug
  // For now build base callback with credentials
  const baseCallbackUrl = `${APP_URL}/auth/callback?apiKey=${encodeURIComponent(apiKey)}&apiSecret=${encodeURIComponent(apiSecret)}`;

  const request_data = {
    url: "https://api.smugmug.com/services/oauth/1.0a/getRequestToken",
    method: "POST",
    data: { oauth_callback: baseCallbackUrl },
  };

  try {
    const authData = oauth.authorize(request_data);
    const bodyParams = new URLSearchParams();
    for (const key in authData) {
      bodyParams.append(key, authData[key]);
    }

    const response = await axios.post(request_data.url, bodyParams.toString(), {
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

    // KEY FIX: Store oauth_token_secret in a short-lived cookie.
    // The browser will send this cookie when SmugMug redirects back to /auth/callback.
    // SameSite=Lax allows it to be sent on top-level cross-site navigations (the OAuth redirect).
    res.setHeader("Set-Cookie", [
      `oauth_token_secret=${encodeURIComponent(oauth_token_secret)}; Path=/; Max-Age=600; SameSite=Lax; Secure; HttpOnly`,
      `sm_api_key=${encodeURIComponent(apiKey)}; Path=/; Max-Age=600; SameSite=Lax; Secure; HttpOnly`,
    ]);

    const authorizeUrl = `https://api.smugmug.com/services/oauth/1.0a/authorize?oauth_token=${oauth_token}&Access=Full&Permissions=Read`;
    res.json({ url: authorizeUrl });
  } catch (error) {
    const errorData = error.response?.data || error.message;
    const errorStr = typeof errorData === "string" ? errorData : JSON.stringify(errorData);

    let userMessage = "Failed to initiate OAuth flow.";
    if (errorStr.includes("consumer_key_unknown")) {
      userMessage = "Invalid SmugMug API Key. Please check your credentials in Settings.";
    } else if (errorStr.includes("signature_invalid")) {
      userMessage = "OAuth signature mismatch. Please verify your API Secret.";
    }

    res.status(500).json({ error: userMessage, details: errorData });
  }
}
