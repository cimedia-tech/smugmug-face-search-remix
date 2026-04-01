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

// Parse cookies from request headers (no cookie-parser in serverless)
const parseCookies = (req) => {
  const cookies = {};
  const cookieHeader = req.headers.cookie || "";
  cookieHeader.split(";").forEach((pair) => {
    const [rawKey, ...rawVal] = pair.trim().split("=");
    if (rawKey) {
      try {
        cookies[rawKey.trim()] = decodeURIComponent(rawVal.join("="));
      } catch {
        cookies[rawKey.trim()] = rawVal.join("=");
      }
    }
  });
  return cookies;
};

export default async function handler(req, res) {
  const { oauth_token, oauth_verifier, apiKey: queryApiKey, apiSecret: queryApiSecret } = req.query;
  const cookies = parseCookies(req);

  // Resolve oauth_token_secret — priority: cookie > query param
  const oauth_token_secret = cookies.oauth_token_secret || req.query.oauth_token_secret || "";

  // Resolve API credentials — priority: query params > cookies > env vars
  const rawApiKey = (queryApiKey || cookies.sm_api_key || DEFAULT_SMUGMUG_API_KEY || "").toString().trim();
  const apiKey = (rawApiKey === "undefined" || rawApiKey === "null") ? "" : rawApiKey;

  const rawApiSecret = (queryApiSecret || DEFAULT_SMUGMUG_API_SECRET || "").toString().trim();
  const apiSecret = (
    rawApiSecret === "undefined" || rawApiSecret === "null" || rawApiSecret === "__server__"
  ) ? DEFAULT_SMUGMUG_API_SECRET : rawApiSecret;

  console.log("Callback received:", {
    hasOauthToken: !!oauth_token,
    hasOauthVerifier: !!oauth_verifier,
    hasTokenSecret: !!oauth_token_secret,
    secretSource: cookies.oauth_token_secret ? "cookie" : (req.query.oauth_token_secret ? "query" : "missing"),
    hasApiKey: !!apiKey,
    hasApiSecret: !!apiSecret,
  });

  if (!oauth_token || !oauth_verifier || !oauth_token_secret) {
    const missing = [];
    if (!oauth_token) missing.push("oauth_token");
    if (!oauth_verifier) missing.push("oauth_verifier");
    if (!oauth_token_secret) missing.push("oauth_token_secret");
    return res.status(400).send(`Missing OAuth parameters: ${missing.join(", ")}. Please try connecting again.`);
  }

  const oauth = getOauth(apiKey, apiSecret);
  const request_data = {
    url: "https://api.smugmug.com/services/oauth/1.0a/getAccessToken",
    method: "POST",
    data: { oauth_verifier },
  };

  const token = {
    key: oauth_token,
    secret: oauth_token_secret,
  };

  try {
    const authData = oauth.authorize(request_data, token);
    const bodyParams = new URLSearchParams();
    for (const key in authData) {
      bodyParams.append(key, authData[key]);
    }
    bodyParams.append("oauth_verifier", oauth_verifier);

    const response = await axios.post(request_data.url, bodyParams.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json, text/plain, */*",
      },
    });

    let access_token = "";
    let access_token_secret = "";

    if (typeof response.data === "string") {
      const params = new URLSearchParams(response.data);
      access_token = params.get("oauth_token") || "";
      access_token_secret = params.get("oauth_token_secret") || "";
    } else if (typeof response.data === "object" && response.data !== null) {
      access_token = response.data.oauth_token || "";
      access_token_secret = response.data.oauth_token_secret || "";
    }

    if (!access_token || !access_token_secret) {
      throw new Error(`Failed to get access tokens. Data: ${JSON.stringify(response.data)}`);
    }

    // Clear the temp request-token cookie
    res.setHeader("Set-Cookie", `oauth_token_secret=; Path=/; Max-Age=0; SameSite=Lax; Secure; HttpOnly`);

    res.send(`
      <html>
        <head><title>Authentication Successful</title>
        <style>
          body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #000; color: #fff; text-align: center; margin: 0; }
          .btn { background: #fff; color: #000; border: none; padding: 12px 24px; border-radius: 20px; cursor: pointer; font-weight: bold; margin-top: 20px; font-size: 14px; }
          h2 { font-weight: 300; }
        </style>
        </head>
        <body>
          <div>
            <h2>Authentication Successful!</h2>
            <p style="color:#666">You can now close this window and return to the app.</p>
            <button class="btn" onclick="window.close()">Close Window</button>
          </div>
          <script>
            (function() {
              var payload = {
                type: 'OAUTH_AUTH_SUCCESS',
                accessToken: '${access_token}',
                accessTokenSecret: '${access_token_secret}',
                timestamp: Date.now()
              };
              // Store in localStorage as fallback
              try { localStorage.setItem('sm_oauth_result', JSON.stringify(payload)); } catch(e) {}
              // Notify opener
              if (window.opener) {
                window.opener.postMessage(payload, '*');
                setTimeout(function() { window.close(); }, 1000);
              }
            })();
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error getting access token:", error.response?.data || error.message);
    const errMsg = typeof (error.response?.data) === "string"
      ? error.response.data
      : JSON.stringify(error.response?.data || error.message);
    res.status(500).send("Failed to complete OAuth flow. " + errMsg);
  }
}
