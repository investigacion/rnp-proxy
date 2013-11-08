/*jshint node:true*/

'use strict';

function empty(object) {
	return (null === object) || (Array.isArray(object) && 0 === object.length) || (0 === Object.keys(object).length);
}

function key(cedula, type) {
	return 'rnp-proxy.' + cedula + '.' + type.toLowerCase();
}

exports.scrape = function(type, cedula, scrape, res) {
	var logger, cache, app, cacheMiss;

	app = res.app;
	cache = app.get('cache');
	logger = app.get('logger');

	if (!(/^\d+$/).test(cedula)) {
		logger.warn('[' + type + '] [' + cedula + '] Received invalid cedula: ' + cedula + '.');

		return res.json(404);
	}

	cacheMiss = function() {
		logger.info('[' + type + '] [' + cedula + '] Cache miss.');

		scrape(app, cedula, function(err, results) {
			var cacheTtl;

			if (err) {
				logger.error('[' + type + '] [' + cedula + '] Error while scraping: ' + err);

				res.json(502, err);

				return;
			}

			if (cache) {
				cacheTtl = app.get('cache ttl');

				logger.info('[' + type + '] [' + cedula + '] Caching result with TTL ' + cacheTtl + '.');

				cache.set(key(cedula, type), JSON.stringify(results), 'EX', cacheTtl, function(err) {
					if (err) {
						logger.error('[' + type + '] Error while setting value in cache: ' + err);
					}
				});
			}

			if (!empty(results)) {
				res.json(results);
			} else {
				res.send(404);
			}
		});
	};

	if (!cache) {
		logger.warn('[' + type + '] Warning: not using cache.');
		return cacheMiss();
	}

	cache.get(key(cedula, type), function(err, results) {
		if (err) {
			logger.error('[' + type + '] [' + cedula + '] Error while getting value from cache: ' + err);

			res.json(502, err);
		} else if (results) {
			results = JSON.parse(results);

			if (empty(results)) {
				logger.info('[' + type + '] [' + cedula + '] Got (empty) results from cache.');

				res.send(404);
			} else {
				logger.info('[' + type + '] [' + cedula + '] Got results from cache.');

				res.json(results);
			}
		} else {
			cacheMiss();
		}
	});
};
