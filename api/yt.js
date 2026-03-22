// Vercel Serverless Function — YouTube API Proxy
// API key safely stored in Vercel Environment Variables

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const YT_API_KEY = process.env.YT_API_KEY;

  if (!YT_API_KEY) {
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  // Get the YouTube endpoint and params from query
  const { endpoint, ...params } = req.query;

  if (!endpoint) {
    return res.status(400).json({ error: 'Missing endpoint param' });
  }

  // Build the YouTube API URL with server-side key
  const searchParams = new URLSearchParams({ ...params, key: YT_API_KEY });
  const ytUrl = `https://www.googleapis.com/youtube/v3/${endpoint}?${searchParams}`;

  try {
    const response = await fetch(ytUrl);
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
