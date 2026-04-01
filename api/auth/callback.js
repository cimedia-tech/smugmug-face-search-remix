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

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const { oauth_token, oauth_verifier, apiKey: queryApiKey, apiSecret: queryApiSecret, oauth_token_secret: queryTokenSecret } = req.query;

  const apiKey = (queryApiKey || DEFAULT_SMUGMUG_API_KEY || "").toString().trim();
  const apiSecret = (queryApiSecret || DEFAULT_SMUGMUG_API_SECRET || "").toString().trim();
  const oauth_token_secret = (queryTokenSecret || "").toString().trim();

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
    const body = new URLSearchParams();
    for (const key in authData) {
      body.append(key, authData[key]);
    }
    body.append("oauth_verifier", oauth_verifier);

    const response = await axios.post(request_data.url, body.toString(), {
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

    // Redirect back to app with tokens in hash (never in URL for security)
    res.send(`
      <html>
        <head><title>Authentication Successful</title>
        <style>
          body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #000; color: #fff; text-align: center; }
          .btn { background: #fff; color: #000; border: none; padding: 10px 20px; border-radius: 20px; cursor: pointer; font-weight: bold; margin-top: 20px; }
        </style>
        </head>
        <body>
          <div>
            <h2>Authentication Successful!</h2>
            <p>You can now close this window and return to the app.</p>
            <button class="btn" onclick="window.close()">Close Window</button>
          </div>
          <script>
            try {
              localStorage.setItem('sm_oauth_result', JSON.stringify({
                type: 'OAUTH_AUTH_SUCCESS',
                accessToken: '${access_token}',
                accessTokenSecret: '${access_token_secret}',
                timestamp: Date.now()
              }));
            } catch (e) {
              console.error('Failed to save to localStorage', e);
            }
            if (window.opener) {
              window.opener.postMessage({
                type: 'OAUTH_AUTH_SUCCESS',
                accessToken: '${access_token}',
                accessTokenSecret: '${access_token_secret}'
              }, '*');
              setTimeout(() => window.close(), 1000);
            }
          </script>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error getting access token:", error.response?.data || error.message);
    res.status(500).send("Failed to complete OAuth flow. " + (error.response?.data || error.message));
  }
}
