'use strict'

const assert = require('node:assert/strict')
const test = require('node:test')
const {
  JUSTWATCH_GRAPHQL,
  handleWatchLinks,
  resetWatchLinksState,
  resolveWatchLinks,
} = require('./watchLinks')

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function graphql(nodes) {
  return {
    data: {
      popularTitles: {
        edges: nodes.map((node) => ({ node })),
      },
    },
  }
}

function movieNode(title, year, offers) {
  return {
    objectType: 'MOVIE',
    content: { title, originalReleaseYear: year },
    offers,
  }
}

function offer(url, packageId, monetizationType = 'FLATRATE') {
  return {
    monetizationType,
    standardWebURL: url,
    package: { packageId },
  }
}

function fakeRes() {
  return {
    headersSent: false,
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value
    },
    end(payload) {
      this.headersSent = true
      this.body = payload
    },
  }
}

function fakeReq(url, extras = {}) {
  return {
    method: 'GET',
    url,
    headers: {},
    socket: { remoteAddress: extras.ip || '203.0.113.10' },
    ...extras,
  }
}

let exclusive = Promise.resolve()

function exclusiveRun(run) {
  const job = exclusive.then(run, run)
  exclusive = job.then(
    () => {},
    () => {},
  )
  return job
}

async function withFetch(fetchImpl, run) {
  return exclusiveRun(async () => {
    const previous = global.fetch
    global.fetch = fetchImpl
    resetWatchLinksState()
    try {
      return await run()
    } finally {
      global.fetch = previous
      resetWatchLinksState()
    }
  })
}

test('prefers a Disney+ title page over a browse entity url', async () => {
  await withFetch(async (url) => {
    assert.equal(url, JUSTWATCH_GRAPHQL)
    return jsonResponse(
      graphql([
        movieNode('Example', 2020, [
          offer(
            'https://www.disneyplus.com/browse/entity-70cc6534-1c7f-4462-87a4-3080c49ac9bc',
            337,
          ),
          offer('https://www.disneyplus.com/movies/example/abc123', 337),
        ]),
      ]),
    )
  }, async () => {
    const result = await resolveWatchLinks({
      title: 'Example',
      year: 2020,
      tmdbId: '1',
      country: 'US',
      services: ['disney-plus'],
    })
    assert.equal(
      result.links['disney-plus'],
      'https://www.disneyplus.com/movies/example/abc123',
    )
  })
})

test('keeps a Disney+ entity page when that is the direct link', async () => {
  await withFetch(async () => {
    return jsonResponse(
      graphql([
        movieNode('Hoppers', 2026, [
          offer(
            'https://www.disneyplus.com/browse/entity-38ce207f-bd54-4e94-92b9-5854b5a409fe',
            337,
          ),
          offer('https://www.disneyplus.com/search/Hoppers', 337),
          offer('https://www.disneyplus.com/', 337),
        ]),
      ]),
    )
  }, async () => {
    const result = await resolveWatchLinks({
      title: 'Hoppers',
      year: 2026,
      tmdbId: '1327819',
      country: 'US',
      services: ['disney-plus'],
    })
    assert.equal(
      result.links['disney-plus'],
      'https://www.disneyplus.com/browse/entity-38ce207f-bd54-4e94-92b9-5854b5a409fe',
    )
  })
})

test('returns a Netflix title url and drops other services that were not requested', async () => {
  await withFetch(async () => {
    return jsonResponse(
      graphql([
        movieNode('Green Book', 2018, [
          offer('https://www.netflix.com/title/81013585?utm_source=justwatch', 8),
          offer(
            'https://www.disneyplus.com/browse/entity-38ce207f-bd54-4e94-92b9-5854b5a409fe',
            337,
          ),
        ]),
      ]),
    )
  }, async () => {
    const result = await resolveWatchLinks({
      title: 'Green Book',
      year: 2018,
      tmdbId: '490132',
      country: 'US',
      services: ['netflix'],
    })
    assert.deepEqual(result.links, {
      netflix: 'https://www.netflix.com/title/81013585',
    })
  })
})

test('drops off-host, search, and wrong-year links and never fetches a caller url', async () => {
  const fetched = []
  await withFetch(async (url, init) => {
    fetched.push(String(url))
    const body = JSON.parse(init.body)
    assert.equal(body.variables.filter.searchQuery, 'Hoppers')
    assert.deepEqual(body.variables.filter.objectTypes, ['MOVIE'])
    assert.equal(body.variables.country, 'US')
    return jsonResponse(
      graphql([
        movieNode('Hoppers', 2026, [
          offer('https://evil.example/title/1', 8),
          offer('https://www.netflix.com/title/999', 337),
          offer('https://www.disneyplus.com/search/Hoppers', 337),
          offer('https://www.disneyplus.com/', 337),
        ]),
      ]),
    )
  }, async () => {
    const result = await resolveWatchLinks({
      title: 'Hoppers',
      year: 2026,
      tmdbId: '1327819',
      country: 'US',
      services: ['netflix', 'disney-plus'],
    })
    assert.deepEqual(result.links, {})
    assert.deepEqual(fetched, [JUSTWATCH_GRAPHQL])
  })
})

test('replaces a Disney+ sing-along page with the movie itself', async () => {
  const singAlong = 'https://www.disneyplus.com/browse/entity-7127bd0d-43ab-491b-a133-5eb55d8d0146'
  const movie = 'https://www.disneyplus.com/browse/entity-ce1ccdca-f468-4960-b67c-026b01ba42ab'
  await withFetch(async (url) => {
    if (String(url) === JUSTWATCH_GRAPHQL) {
      return jsonResponse(
        graphql([
          movieNode('Coco', 2017, [offer(singAlong, 337)]),
        ]),
      )
    }
    if (String(url) === singAlong) {
      return new Response(
        '<title>Coco Sing-Along | Watch on Disney+</title>' +
          '<a aria-label="Coco" href="/browse/entity-ce1ccdca-f468-4960-b67c-026b01ba42ab"></a>',
        { status: 200 },
      )
    }
    if (String(url) === movie) {
      return new Response('<title>Coco | Watch on Disney+</title>', { status: 200 })
    }
    throw new Error(`unexpected fetch ${url}`)
  }, async () => {
    const result = await resolveWatchLinks({
      title: 'Coco',
      year: 2017,
      tmdbId: '354912',
      country: 'US',
      services: ['disney-plus'],
    })
    assert.equal(result.links['disney-plus'], movie)
  })
})

test('matches WALL·E when the query uses WALL-E', async () => {
  await withFetch(async () => {
    return jsonResponse(
      graphql([
        movieNode('WALL·E', 2008, [
          offer(
            'https://www.disneyplus.com/browse/entity-280395a4-d5ef-4dd0-bd09-d91c31593d3d',
            337,
          ),
        ]),
      ]),
    )
  }, async () => {
    const result = await resolveWatchLinks({
      title: 'WALL-E',
      year: 2008,
      tmdbId: '10681',
      country: 'US',
      services: ['disney-plus'],
    })
    assert.match(result.links['disney-plus'], /entity-280395a4/)
  })
})

test('caches a hit and shares an in-flight lookup', async () => {
  let calls = 0
  await withFetch(async () => {
    calls += 1
    await new Promise((resolve) => setTimeout(resolve, 20))
    return jsonResponse(
      graphql([
        movieNode('Green Book', 2018, [
          offer('https://www.netflix.com/title/81013585', 8),
        ]),
      ]),
    )
  }, async () => {
    const input = {
      title: 'Green Book',
      year: 2018,
      tmdbId: '490132',
      country: 'US',
      services: ['netflix'],
    }
    const [first, second] = await Promise.all([
      resolveWatchLinks(input),
      resolveWatchLinks(input),
    ])
    const third = await resolveWatchLinks(input)
    assert.equal(calls, 1)
    assert.equal(first.links.netflix, 'https://www.netflix.com/title/81013585')
    assert.equal(second.links.netflix, first.links.netflix)
    assert.equal(third.links.netflix, first.links.netflix)
  })
})

test('returns no links when JustWatch fails, without throwing', async () => {
  await withFetch(async () => {
    throw new Error('down')
  }, async () => {
    const result = await resolveWatchLinks({
      title: 'Green Book',
      year: 2018,
      tmdbId: '490132',
      country: 'US',
      services: ['netflix'],
    })
    assert.deepEqual(result.links, {})
  })
})

test('rejects bad input and ignores a url parameter', async () => {
  const fetched = []
  await withFetch(async (url) => {
    fetched.push(String(url))
    return jsonResponse(graphql([]))
  }, async () => {
    const cases = [
      ['/api/watch-links?title=&year=2020', 400],
      ['/api/watch-links?title=Hoppers&tmdbId=abc', 400],
      ['/api/watch-links?title=Hoppers&year=12', 400],
      ['/api/watch-links?title=Hoppers&country=DE', 400],
      ['/api/watch-links?title=Hoppers&services=netflix,evil', 400],
      ['/api/watch-links?title=Hoppers&services=disney-plus&url=https://evil.example', 200],
    ]
    let okBody = ''
    for (const [url, status] of cases) {
      const req = fakeReq(url, { ip: `203.0.113.${url.length}` })
      const res = fakeRes()
      await handleWatchLinks(req, res)
      assert.equal(res.statusCode, status, url)
      if (status === 200) okBody = res.body
    }
    assert.deepEqual(fetched, [JUSTWATCH_GRAPHQL])
    assert.deepEqual(JSON.parse(okBody).links, {})
  })
})

test('GET returns cache headers and POST is rejected', async () => {
  await withFetch(async () => {
    return jsonResponse(
      graphql([
        movieNode('Green Book', 2018, [
          offer('https://www.netflix.com/title/81013585', 8),
        ]),
      ]),
    )
  }, async () => {
    const res = fakeRes()
    await handleWatchLinks(
      fakeReq(
        '/api/watch-links?tmdbId=490132&title=Green%20Book&year=2018&services=netflix&country=US',
      ),
      res,
    )
    assert.equal(res.statusCode, 200)
    assert.match(res.headers['cache-control'], /public, max-age=120/)
    assert.equal(
      JSON.parse(res.body).links.netflix,
      'https://www.netflix.com/title/81013585',
    )

    const denied = fakeRes()
    await handleWatchLinks(
      fakeReq('/api/watch-links?title=Green%20Book', {
        method: 'POST',
        ip: '203.0.113.50',
      }),
      denied,
    )
    assert.equal(denied.statusCode, 405)
  })
})

test(
  'live JustWatch titles',
  { skip: process.env.WATCH_LINKS_LIVE !== '1' },
  async () => {
    await exclusiveRun(async () => {
    resetWatchLinksState()
    const cases = [
      {
        title: 'Spider-Man: Across the Spider-Verse',
        year: 2023,
        tmdbId: '569094',
        services: ['disney-plus'],
        service: 'disney-plus',
        pattern: /https:\/\/www\.disneyplus\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:browse\/entity-|movies\/)/i,
      },
      {
        title: 'WALL·E',
        year: 2008,
        tmdbId: '10681',
        services: ['disney-plus'],
        service: 'disney-plus',
        pattern: /https:\/\/www\.disneyplus\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:browse\/entity-|movies\/)/i,
      },
      {
        title: 'Hoppers',
        year: 2026,
        tmdbId: '1327819',
        services: ['disney-plus'],
        service: 'disney-plus',
        pattern: /https:\/\/www\.disneyplus\.com\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?(?:browse\/entity-|movies\/)/i,
      },
      {
        title: 'Green Book',
        year: 2018,
        tmdbId: '490132',
        services: ['netflix'],
        service: 'netflix',
        pattern: /https:\/\/www\.netflix\.com\/title\/\d+/,
      },
      {
        title: 'Coco',
        year: 2017,
        tmdbId: '354912',
        services: ['disney-plus'],
        service: 'disney-plus',
        pattern: /https:\/\/www\.disneyplus\.com\/browse\/entity-ce1ccdca-f468-4960-b67c-026b01ba42ab/,
      },
    ]

    for (const entry of cases) {
      const result = await resolveWatchLinks({
        title: entry.title,
        year: entry.year,
        tmdbId: entry.tmdbId,
        country: 'US',
        services: entry.services,
      })
      const href = result.links[entry.service]
      console.log(`${entry.title}: ${href}`)
      assert.equal(typeof href, 'string', entry.title)
      assert.match(href, entry.pattern, `${entry.title} -> ${href}`)
      assert.doesNotMatch(href, /\/search(?:\/|$)/i, entry.title)
      const params = new URLSearchParams({
        tmdbId: entry.tmdbId,
        title: entry.title,
        year: String(entry.year),
        country: 'US',
        services: entry.services.join(','),
      })
      const res = fakeRes()
      await handleWatchLinks(
        fakeReq(`/api/watch-links?${params}`, { ip: '203.0.113.80' }),
        res,
      )
      assert.equal(res.statusCode, 200, entry.title)
      assert.equal(JSON.parse(res.body).links[entry.service], href)
    }
    })
  },
)
