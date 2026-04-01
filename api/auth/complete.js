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

// Called by the client-side relay page in /auth/callback.
// Receives all OAuth params in the POST body — no server session needed.
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { oauthToken, oauthVerifier, oauthTokenSecret, apiKey: bodyApiKey, apiSecret: bodyApiSecret } = req.body || {};

  const apiKey = (bodyApiKey || DEFAULT_SMUGMUG_API_KEY || "").toString().trim();
  const rawSecret = (bodyApiSecret || DEFAULT_SMUGMUG_API_SECRET || "").toString().trim();
  const apiSecret = (rawSecret === "__server__") ? DEFAULT_SMUGMUG_API_SECRET : rawSecret;

  if (!oauthToken || !oauthVerifier || !oauthTokenSecret) {
    return res.status(400).json({ error: "Missing OAuth parameters." });
  }

  const oauth = getOauth(apiKey, apiSecret);
  const request_data = {
    url: "https://api.smugmug.com/services/oauth/1.0a/getAccessToken",
    method: "POST",
    data: { oauth_verifier: oauthVerifier },
  };
  const token = { key: oauthToken, secret: oauthTokenSecret };

  try {
    const authData = oauth.authorize(request_data, token);
    const bodyParams = new URLSearchParams();
    for (const key in authData) bodyParams.append(key, authData[key]);
    bodyParams.append("oauth_verifier", oauthVerifier);

    const response = await axios.post(request_data.url, bodyParams.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json, text/plain, */*",
      },
    });

    let access_token = "";
    let access_token_secret = "";

    if (typeof response.data === "string") {
      const p = new URLSearchParams(response.data);
      access_token = p.get("oauth_token") || "";
      access_token_secret = p.get("oauth_token_secret") || "";
    } else if (typeof response.data === "object" && response.data !== null) {
      access_token = response.data.oauth_token || "";
      access_token_secret = response.data.oauth_token_secret || "";
    }

    if (!access_token || !access_token_secret) {
      throw new Error(`Failed to get access tokens. Response: ${JSON.stringify(response.data)}`);
    }

    res.json({ accessToken: access_token, accessTokenSecret: access_token_secret });
  } catch (error) {
    console.error("Error completing OAuth:", error.response?.data || error.message);
    res.status(500).json({
      error: "Failed to complete OAuth flow.",
      details: error.response?.data || error.message,
    });
  }
}
