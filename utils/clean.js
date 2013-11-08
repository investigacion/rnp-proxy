/**
 * This utility was used to clean out mercantil keys with badly normalised cedulas juridicas.
 */

/*jshint node:true*/

'use strict';

var redis = require('redis');
var async = require('async');

var cache = redis.createClient();
var queue = async.queue(function(key, cb) {
	cache.GET(key, function(err, json) {
		var data, found;

		if (err) {
			console.error(err);
			return process.exit(1);
		}

		try {
			data = JSON.parse(json);
		} catch (err) {
			console.error(err);
			console.error(json);
			return process.exit(1);
		}

		found = data.some(function(point) {
			return point.cedulaJurídica.length < 10;
		});

		if (found) {
			console.log('Deleting key ' + key + '.');
			cache.DEL(key, function(err) {
				if (err) {
					console.error(err);
					return process.exit(1);
				}
	
				cb();
			});
		} else {
			cb();
		}
	});
}, 1);

cache.KEYS('rnp-proxy.*.mercantil', function(err, keys) {
	if (err) {
		console.error(err);
		return process.exit(1);
	}

	queue.push(keys);
});
