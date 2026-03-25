const { onRequest } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')

const footballApiKey = defineSecret('FOOTBALL_DATA_API_KEY')

/**
 * Proxy for football-data.org — bypasses CORS restriction on free tier.
 * Called only by admin for tournament import (very low usage).
 */
exports.footballProxy = onRequest(
  { secrets: [footballApiKey], cors: ['https://sdy-wc.web.app', 'http://localhost:5173'] },
  async (req, res) => {
    const path = req.query.path
    if (!path) {
      res.status(400).json({ error: 'Missing path parameter' })
      return
    }

    // Only allow GET requests to football-data.org
    const allowed = /^\/v4\/(competitions|matches|teams|persons)(\/.*)?$/
    if (!allowed.test(path)) {
      res.status(403).json({ error: 'Path not allowed' })
      return
    }

    try {
      const response = await fetch(`https://api.football-data.org${path}`, {
        headers: { 'X-Auth-Token': footballApiKey.value() },
      })
      const data = await response.json()
      res.status(response.status).json(data)
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  }
)
