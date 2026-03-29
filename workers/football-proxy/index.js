export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      })
    }

    const url    = new URL(request.url)
    const target = `https://api.football-data.org${url.pathname}${url.search}`
    const resp   = await fetch(target, {
      headers: { 'X-Auth-Token': env.FOOTBALL_DATA_API_KEY },
    })
    const body   = await resp.text()

    return new Response(body, {
      status:  resp.status,
      headers: {
        'Content-Type':                'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  },
}
