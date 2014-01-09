# rnp-proxy #

RESTful HTTP proxy for rnpdigital.com, the *Registro Nacional de Costa Rica*. Use it as a basis for your own scraper by running requests against the proxy.

Written by [Matthew Caruana Galizia](https://twitter.com/mcaruanagalizia) at La Nación.

## Features ##

 - Optionally caches results using [Redis](http://redis.io/) (off by default).
 - Supports a credential pool. Supply multiple `username:password` sets to increase concurrency.
 - SOCKS5 proxying.

## Usage ##

Run `node proxy.js` to see available command line options.

Currently supports the following routes. Response body is always JSON.

### GET /cedulas/[cedula]/mercantil ###

Get company-related data for the given _cédula física_.

### GET /cedulas/[cedula]/morosidad ###

Get tax-defaulter data for the given _cédula juridica_.

### GET /credentials ###

Get the current credential list.

### PUT /credentials ###

Set the credential list. For example:

```bash
curl -X PUT -H "Content-Type: application/json" -d '["user@example.com:password"]' http://localhost:3000/credentials
```

## License ##

MIT
