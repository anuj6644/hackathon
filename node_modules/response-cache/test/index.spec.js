const redis = require('redis')
const ResponseCache = require('../src/index')


describe('test response cache api', () => {
  let redisClient = null
  beforeAll(async () => {
    redisClient = await redis.createClient()
    redisClient.on('error', (err) => {
      console.error(err)
      console.log('%s Redis connection error. Please make sure Redis is running.')
    })
  })

  afterAll(() => redisClient.quit())

  it('Should return a object with cache and clear function', async () => {
    const responseCache = await ResponseCache(redisClient)
    expect.assertions(2)
    expect(responseCache).toBeTruthy()
    expect(typeof responseCache).toEqual('object')
  })
})