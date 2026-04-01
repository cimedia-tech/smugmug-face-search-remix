// Client-side relay page — no server state required.
// SmugMug redirects the popup here with oauth_token + oauth_verifier.
// This page reads the oauth_token_secret from localStorage (stored by the frontend
// when it opened the popup), then calls /api/auth/complete to finish the exchange.
export default function handler(req, res) {
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html>
  <head>
    <title>Completing Authentication...</title>
    <style>
      body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; background: #000; color: #fff; text-align: center; margin: 0; }
      p { color: #666; }
    </style>
  </head>
  <body>
    <div><p id="msg">Completing authentication...</p></div>
    <script>
      (async () => {
        const params = new URLSearchParams(window.location.search);
        const oauthToken = params.get('oauth_token');
        const oauthVerifier = params.get('oauth_verifier');
        const oauthTokenSecret = localStorage.getItem('oauth_secret_' + oauthToken);
        const apiKey = params.get('apiKey') || localStorage.getItem('sm_api_key') || '';
        const apiSecret = params.get('apiSecret') || localStorage.getItem('sm_api_secret') || '';

        if (!oauthToken || !oauthVerifier || !oauthTokenSecret) {
          document.getElementById('msg').textContent =
            'Error: Missing OAuth parameters (secret: ' + !!oauthTokenSecret + '). Please try connecting again.';
          return;
        }

        try {
          const res = await fetch('/api/auth/complete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ oauthToken, oauthVerifier, oauthTokenSecret, apiKey, apiSecret })
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to complete OAuth');

          localStorage.removeItem('oauth_secret_' + oauthToken);

          const result = {
            type: 'OAUTH_AUTH_SUCCESS',
            accessToken: data.accessToken,
            accessTokenSecret: data.accessTokenSecret,
            timestamp: Date.now()
          };
          localStorage.setItem('sm_oauth_result', JSON.stringify(result));

          document.getElementById('msg').textContent = 'Authenticated! Closing window...';

          if (window.opener) {
            window.opener.postMessage(result, '*');
            setTimeout(() => window.close(), 500);
          } else {
            document.getElementById('msg').textContent = 'Authentication successful! You can close this window.';
          }
        } catch (err) {
          document.getElementById('msg').textContent = 'Authentication failed: ' + err.message;
        }
      })();
    </script>
  </body>
</html>`);
}
