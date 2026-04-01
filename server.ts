import "dotenv/config";
import express from "express";
import session from "express-session";
import cookieParser from "cookie-parser";
import OAuth from "oauth-1.0a";
import CryptoJS from "crypto-js";
import axios from "axios";
import path from "path";
import { createServer as createViteServer } from "vite";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// Trust proxy for session cookies in iframe
app.set("trust proxy", 1);

// SmugMug OAuth Config
const DEFAULT_SMUGMUG_API_KEY = (process.env.SMUGMUG_API_KEY || "").trim();
const DEFAULT_SMUGMUG_API_SECRET = (process.env.SMUGMUG_API_SECRET || "").trim();
const APP_URL = (process.env.APP_URL || `http://localhost:${PORT}`).replace(/\/$/, "");

// Server-side storage for OAuth secrets (fallback for session loss in iframes)
const oauthSecrets = new Map<string, { secret: string; apiKey: string; apiSecret: string }>();

const getOauth = (apiKey?: string, apiSecret?: string) => {
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

app.use(express.json());
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "smugmug-face-search-secret",
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: true,
      sameSite: "none",
      httpOnly: true,
    },
  })
);

// Helper to get credentials from cookies, body, query, or env
const getCredentials = (req: express.Request) => {
  const rawApiKey = (
    req.headers["x-smugmug-api-key"] ||
    req.body.apiKey || 
    req.query.apiKey || 
    req.cookies.sm_api_key || 
    DEFAULT_SMUGMUG_API_KEY || 
    ""
  ).toString().trim();
  
  const rawApiSecret = (
    req.headers["x-smugmug-api-secret"] ||
    req.body.apiSecret || 
    req.query.apiSecret || 
    req.cookies.sm_api_secret || 
    DEFAULT_SMUGMUG_API_SECRET || 
    ""
  ).toString().trim();

  // Guard against "undefined" or "null" strings
  const apiKey = (rawApiKey === "undefined" || rawApiKey === "null") ? "" : rawApiKey;
  const apiSecret = (rawApiSecret === "undefined" || rawApiSecret === "null") ? "" : rawApiSecret;
  
  return { apiKey, apiSecret };
};

// OAuth Endpoints
app.all("/api/auth/url", async (req, res) => {
  const { apiKey, apiSecret } = getCredentials(req);
  
  if (!apiKey || !apiSecret) {
    return res.status(400).json({ 
      error: "SmugMug API credentials not configured.",
      details: "Please click the Settings icon (gear) and enter your API Key and Secret."
    });
  }

  // Log masked key for debugging (safe)
  console.log(`Initiating OAuth with Key: ${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}`);

  const oauth = getOauth(apiKey, apiSecret);
  // Include credentials in the callback URL to bypass session issues in iframes.
  // Note: We can't include the token_secret here because we don't have it yet.
  const callbackUrl = `${APP_URL}/auth/callback?apiKey=${encodeURIComponent(apiKey)}&apiSecret=${encodeURIComponent(apiSecret)}`;
  
  const request_data = {
    url: "https://api.smugmug.com/services/oauth/1.0a/getRequestToken",
    method: "POST",
    data: { oauth_callback: callbackUrl },
  };

  try {
    const authData = oauth.authorize(request_data);
    
    // Some OAuth 1.0a servers (like SmugMug) are more compatible when 
    // parameters are sent in the POST body instead of the Authorization header.
    const body = new URLSearchParams();
    for (const key in authData) {
      body.append(key, (authData as any)[key]);
    }

    console.log(`Requesting token from: ${request_data.url} (POST with body params)`);
    const response = await axios.post(request_data.url, body.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json, text/plain, */*",
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
      throw new Error(`Failed to get tokens from SmugMug response. Data type: ${typeof response.data}. Data: ${JSON.stringify(response.data)}`);
    }

    // Store secret in session for later
    (req.session as any).oauth_token_secret = oauth_token_secret;
    
    // Store in server-side map as robust fallback for iframe session loss
    oauthSecrets.set(oauth_token, { 
      secret: oauth_token_secret, 
      apiKey, 
      apiSecret 
    });
    // Clean up old secrets after 10 minutes
    setTimeout(() => oauthSecrets.delete(oauth_token), 10 * 60 * 1000);

    // Set a cookie as fallback for iframe session issues
    res.cookie("oauth_token_secret", oauth_token_secret, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 10 * 60 * 1000, // 10 minutes
    });

    // Also include it in the authorize URL if we need to pass it back (optional but safer)
    const authorizeUrl = `https://api.smugmug.com/services/oauth/1.0a/authorize?oauth_token=${oauth_token}&Access=Full&Permissions=Read`;
    
    // We can't easily append to SmugMug's authorize URL and expect it back, 
    // but we've already appended to our callbackUrl in the request_data.
    
    res.json({ url: authorizeUrl });
  } catch (error: any) {
    const errorData = error.response?.data || error.message;
    console.error("SmugMug Request Token Error:", errorData);
    
    let userMessage = "Failed to initiate OAuth flow.";
    const errorStr = typeof errorData === "string" ? errorData : JSON.stringify(errorData);
    if (errorStr.includes("consumer_key_unknown")) {
      userMessage = `Invalid SmugMug API Key. The key "${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}" was not recognized by SmugMug.`;
    } else if (errorStr.includes("signature_invalid")) {
      userMessage = "OAuth signature mismatch. Please verify your API Secret.";
    }

    res.status(500).json({ 
      error: userMessage,
      details: errorData,
      debug: {
        keyLength: apiKey.length,
        keyPrefix: apiKey.substring(0, 4),
        keySuffix: apiKey.substring(apiKey.length - 4),
        method: request_data.method,
        callback: callbackUrl,
        paramsSent: "body"
      }
    });
  }
});

app.get("/auth/callback", async (req, res) => {
  const { oauth_token, oauth_verifier, apiKey: queryApiKey, apiSecret: queryApiSecret, token_secret: queryTokenSecret } = req.query;
  
  // Try to get secret and credentials from server-side map first (most reliable in iframes)
  const storedData = oauth_token ? oauthSecrets.get(oauth_token as string) : null;
  
  const oauth_token_secret = 
    storedData?.secret ||
    (req.session as any).oauth_token_secret || 
    req.cookies.oauth_token_secret || 
    queryTokenSecret;
    
  const apiKey = (storedData?.apiKey || queryApiKey || req.cookies.sm_api_key || DEFAULT_SMUGMUG_API_KEY || "").toString().trim();
  const apiSecret = (storedData?.apiSecret || queryApiSecret || req.cookies.sm_api_secret || DEFAULT_SMUGMUG_API_SECRET || "").toString().trim();

  if (!oauth_token || !oauth_verifier || !oauth_token_secret) {
    const missing = [];
    if (!oauth_token) missing.push("oauth_token");
    if (!oauth_verifier) missing.push("oauth_verifier");
    if (!oauth_token_secret) missing.push("oauth_token_secret");
    
    console.error("Callback Missing Params:", { 
      missing,
      hasToken: !!oauth_token, 
      hasVerifier: !!oauth_verifier, 
      hasSecret: !!oauth_token_secret,
      hasStoredData: !!storedData,
      sessionID: req.sessionID
    });
    return res.status(400).send(`Missing OAuth parameters: ${missing.join(", ")}. Please try connecting again.`);
  }

  console.log(`Completing OAuth for token: ${oauth_token} with Key: ${apiKey.substring(0, 4)}...`);

  const oauth = getOauth(apiKey, apiSecret);
  const request_data = {
    url: "https://api.smugmug.com/services/oauth/1.0a/getAccessToken",
    method: "POST",
    data: { oauth_verifier },
  };

  const token = {
    key: oauth_token as string,
    secret: oauth_token_secret as string,
  };

  try {
    const authData = oauth.authorize(request_data, token);
    
    // Use body params for getAccessToken signature as well, more consistent
    const body = new URLSearchParams();
    for (const key in authData) {
      body.append(key, (authData as any)[key]);
    }
    body.append("oauth_verifier", oauth_verifier as string);

    const response = await axios.post(request_data.url, body.toString(), {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json, text/plain, */*",
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
      throw new Error(`Failed to get access tokens from SmugMug response. Data type: ${typeof response.data}. Data: ${JSON.stringify(response.data)}`);
    }

    // Store access token in session or cookie
    res.cookie("sm_access_token", access_token, { secure: true, sameSite: "none", httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });
    res.cookie("sm_access_token_secret", access_token_secret, { secure: true, sameSite: "none", httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000 });

    res.send(`
      <html>
        <head>
          <title>Authentication Successful</title>
          <style>
            body { font-family: sans-serif; display: flex; flex-col; align-items: center; justify-content: center; height: 100vh; background: #000; color: #fff; text-align: center; }
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
            // Store tokens in localStorage as a fallback for window.opener being null
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
              // Give it a moment to send before closing
              setTimeout(() => window.close(), 1000);
            } else {
              console.log('No window.opener found. Please close this window manually.');
            }
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    console.error("Error getting access token:", error.response?.data || error.message);
    res.status(500).send("Failed to complete OAuth flow. " + (error.response?.data || error.message));
  }
});

// Proxy API for SmugMug
app.get("/api/smugmug/*", async (req, res) => {
  const access_token = req.headers["x-smugmug-access-token"] || req.cookies.sm_access_token;
  const access_token_secret = req.headers["x-smugmug-access-token-secret"] || req.cookies.sm_access_token_secret;
  const { apiKey, apiSecret } = getCredentials(req);

  if (!access_token || !access_token_secret) {
    return res.status(401).json({ error: "Not authenticated with SmugMug." });
  }

  const oauth = getOauth(apiKey, apiSecret);
  let apiPath = req.params[0];
  
  // Strip leading /api/v2/ or api/v2/ if present to avoid duplication
  const cleanPath = apiPath.replace(/^(\/)?api\/v2\//, "").replace(/^\//, "");
  
  // SmugMug root methods (starting with !) don't have a slash after /api/v2
  const separator = cleanPath.startsWith("!") ? "" : "/";
  
  // Construct the base URL without query params for OAuth signing if needed, 
  // but oauth-1.0a can handle query params in the URL.
  // SmugMug API v2 root methods like !authuser are appended directly to /api/v2
  const baseUrl = `https://api.smugmug.com/api/v2${separator}${cleanPath}`;
  
  // Handle query parameters
  const params = new URLSearchParams();
  // Copy existing query params from the request
  for (const [key, value] of Object.entries(req.query)) {
    if (key !== '_accept') { // We'll set this explicitly to ensure consistency
      params.append(key, value as string);
    }
  }
  // Ensure _accept=json is set for the API response
  params.set('_accept', 'json');
  
  const queryString = params.toString();
  const fullUrl = `${baseUrl}${queryString ? "?" + queryString : ""}`;
  
  const request_data = {
    url: fullUrl,
    method: "GET",
  };

  const token = {
    key: access_token,
    secret: access_token_secret,
  };

  try {
    console.log(`Proxying SmugMug request to: ${fullUrl}`);
    const response = await axios.get(fullUrl, {
      headers: {
        ...oauth.toHeader(oauth.authorize(request_data, token)),
        "Accept": "application/json",
        "User-Agent": "SmugMugFaceSearch/1.0",
      },
    });
    res.json(response.data);
  } catch (error: any) {
    console.error("SmugMug API Error:", error.response?.data || error.message);
    const status = error.response?.status || 500;
    const errorData = error.response?.data || { error: "SmugMug API request failed." };
    
    res.status(status).json({
      ...errorData,
      url: fullUrl,
      proxyError: error.message
    });
  }
});

// Proxy image to avoid CORS and fetch as base64
app.get("/api/proxy-image", async (req, res) => {
  const imageUrl = req.query.url as string;
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
});

// Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
