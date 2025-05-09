function CacheResponse(redisClient) {
  // const redisClient = redisClient
  const branch = 'cache-response:'
  function cache(options = {}) {
    return async function (req, res, next) {
      const duration = options.duration || 12 * 60 * 60
      if (!redisClient) return next()
      const _end = res.end
      const _write = res.write
      let headers = null
      const prefixKey = options.prefix_key
      let key = options.key ? options.key : req.originalUrl
      let keyTmp = key
      const objectCache = {
        headers,
        body: null
      }

      // only GET method
      if (req.method.toUpperCase() !== 'GET') return next()

      // check key exists in redis
      if (prefixKey) {
        if (typeof prefixKey === 'boolean') {
          const branchTmp = branch + '*'
          const keys = await redisClient.keysAsync(branchTmp)
          if (keys.length > 0) {
            for (let indexKey = 0; indexKey < keys.length; indexKey++) {
              const key = keys[indexKey]
              if (key.includes(req.originalUrl)) {
                keyTmp = key
                break
              }
            }
          }
        } else {
          keyTmp = `${prefixKey}:${key}`
        }
      }
      const getcacheResponse = await redisClient.hgetallAsync(keyTmp)
      if (getcacheResponse) {
        res.set(JSON.parse(getcacheResponse.headers)) // Set headers
        res.setHeader('Last-Modified', new Date().toUTCString())
        res.send(getcacheResponse.body) // Send body
        return
      }

      /**
       * process chunks in buffer of response api
       * @param {*} content
       */
      function hanldeContent(content) {
        if (content) {
          if (typeof content === 'string') {
            objectCache.body = (objectCache.body || '') + content
          } else if (Buffer.isBuffer(content)) {
            var oldContent = objectCache.body

            if (typeof oldContent === 'string') {
              oldContent = Buffer.from(oldContent)
            }

            if (!oldContent) {
              oldContent = Buffer.alloc(0)
            }

            // Merge chunks
            objectCache.body = Buffer.concat(
              [oldContent, content],
              oldContent.length + content.length
            )
          } else {
            objectCache.body = content
          }
        }
      }

      /**
       * @description: save data into redis
       */
      async function cacheResponse() {
        if (redisClient) {
          try {
            objectCache.headers = res.getHeaders
              ? res.getHeaders()
              : res._headers
            const prefixHeader = objectCache.headers.prefix_key
            objectCache.headers = JSON.stringify(objectCache.headers)
            if (prefixKey) {
              if (typeof prefixKey === 'boolean') {
                key = prefixHeader ? `${prefixHeader}:${key}` : key
              } else {
                key = `${prefixKey}:${key}`
              }
            }
            key = branch + key
            await redisClient.hmsetAsync(key, objectCache)
            await redisClient.expire(key, duration)
          } catch (err) {
            console.log('[apicache] error in redis.hset()')
          }
        } else {
          // next version use memory cache
        }
      }

      // Overwrite write function to heandle chunk
      res.write = function (content) {
        hanldeContent(content)
        _write.apply(res, arguments)
      }

      // Overwrite end function to cache data
      res.end = function (content, encoding) {
        hanldeContent(content, encoding)
        // avoid status 304 http
        res.setHeader('Last-Modified', new Date().toUTCString())
        // Send data to client before caching
        _end.apply(res, arguments)
        // only cache when statusCode = 200
        if (res.statusCode === 200) {
          cacheResponse(req.originalUrl, objectCache, duration)
        }
      }
      // next to middleware
      next()
    }
  }

  function clear (prefixKey, params) {
    if (prefixKey) {
      const keyInRedis = `${branch}${prefixKey}:*`
      redisClient.keys(keyInRedis, function (err, keys) {
        if (err) {
          console.log(err)
          return
        }
        if (keys.length > 0) {
          const {urlAPI, level, type, date} = params
          if (params) {
          // my custom
            const keyTmp = []
            keys.forEach(item => {
              if (urlAPI && urlAPI.includes(item)) {
                keyTmp.push(item)
              }
              if (level && type && item.includes(level) && item.includes(type) && item.includes(date)) {
                keyTmp.push(item)
              }
              if (level && item.includes(level) && item.includes(date) && !keyTmp.includes(item)) {
                keyTmp.push(item)
              }
              if (type && item.includes(type) && item.includes(date) && !keyTmp.includes(item)) {
                keyTmp.push(item)
              }
            })
            if (keyTmp.length > 0) {
              redisClient.del(keyTmp)
            }
          } else {
            redisClient.del(keys)
          }
        }
      })
    }
  }
  return {
    cache,
    clear
  }
}

module.exports = CacheResponse
