import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { cors } from "hono/cors";
import { appRouter } from "./trpc/app-router";
import { createContext } from "./trpc/create-context";

const SPOTIFY_CLIENT_ID = "cb884c0e045d4683bd3f0b38cb0e151e";
const SPOTIFY_CLIENT_SECRET = process.env.EXPO_PUBLIC_SPOTIFY_CLIENT_SECRET || "";

// app will be mounted at /api
const app = new Hono();

// Enable CORS for all routes
app.use("*", cors());

// Mount tRPC router at /trpc
app.use(
  "/trpc/*",
  trpcServer({
    endpoint: "/api/trpc",
    router: appRouter,
    createContext,
  })
);

// Simple health check endpoint
app.get("/", (c) => {
  return c.json({ status: "ok", message: "API is running" });
});

// Spotify OAuth callback handler
app.get("/spotify/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  console.log("Spotify callback received:", { code: !!code, state, error });

  if (error) {
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head><title>Spotify Auth Error</title></head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'SPOTIFY_AUTH_ERROR', error: '${error}' }, '*');
              window.close();
            } else {
              document.body.innerHTML = '<h1>Authentication Error</h1><p>${error}</p><p>You can close this window.</p>';
            }
          </script>
        </body>
      </html>
    `);
  }

  if (!code) {
    return c.html(`
      <!DOCTYPE html>
      <html>
        <head><title>Spotify Auth Error</title></head>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'SPOTIFY_AUTH_ERROR', error: 'No authorization code received' }, '*');
              window.close();
            } else {
              document.body.innerHTML = '<h1>Error</h1><p>No authorization code received.</p>';
            }
          </script>
        </body>
      </html>
    `);
  }

  // Return HTML that sends the code back to the opener window
  // The client will handle the token exchange using PKCE
  return c.html(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Spotify Authorization</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #1DB954 0%, #191414 100%);
            color: white;
          }
          .container {
            text-align: center;
            padding: 40px;
            background: rgba(0,0,0,0.5);
            border-radius: 16px;
          }
          .spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(255,255,255,0.3);
            border-top-color: #1DB954;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="spinner"></div>
          <h2>Completing Authorization...</h2>
          <p>Please wait while we finish connecting to Spotify.</p>
        </div>
        <script>
          (function() {
            const code = '${code}';
            const state = '${state || ""}';
            
            console.log('Spotify callback page loaded with code');
            
            if (window.opener) {
              console.log('Sending auth code to opener window...');
              window.opener.postMessage({
                type: 'SPOTIFY_AUTH_CODE',
                code: code,
                state: state,
                url: window.location.href
              }, '*');
              
              setTimeout(() => {
                window.close();
              }, 1500);
            } else {
              // No opener - redirect to app with code
              const appUrl = window.location.origin + '/spotify-integration?code=' + encodeURIComponent(code) + '&state=' + encodeURIComponent(state);
              document.body.innerHTML = '<div class="container"><h2>Authorization Complete!</h2><p>Redirecting to app...</p></div>';
              setTimeout(() => {
                window.location.href = appUrl;
              }, 1000);
            }
          })();
        </script>
      </body>
    </html>
  `);
});

export default app;