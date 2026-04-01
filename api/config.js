// Exposes non-secret public config to the frontend.
// Only exposes keys if they are set as env vars (for shared/demo deployments).
export default function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  res.json({
    hasServerKeys: !!(process.env.SMUGMUG_API_KEY && process.env.SMUGMUG_API_SECRET),
    // Only expose if explicitly set — users can override in browser settings
    smugmugApiKey: process.env.SMUGMUG_API_KEY || "",
    // Never expose secret — keep it server-side only
    hasApiSecret: !!process.env.SMUGMUG_API_SECRET,
  });
}
