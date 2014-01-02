# rnp-proxy #

RESTful HTTP proxy for rnpdigital.com, the *Registro Nacional de Costa Rica*. Use it as a basis for your own scraper by running requests against the proxy.

Optionally caches results using [Redis](http://redis.io/) (on by default).

Written by [Matthew Caruana Galizia](https://twitter.com/mcaruanagalizia) at La Nación.

## Usage ##

Run `node proxy.js` to see available command line options.

Currently supports the following routes.

### `/cedulas/[cedula]/mercantil` ###

Get company-related data for the given _cédula física_.

### `/cedulas/[cedula]/morosidad` ###

Get tax-defaulter data for the given _cédula juridica_.

## License ##

MIT
