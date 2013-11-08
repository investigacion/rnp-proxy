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
		var data;

		if (err) {
			return cb(err);
		}

		data = JSON.parse(json);

		data.forEach(function(point) {
			if (point.cedulaJurídica) {
				point.cedulaJuridica = point.cedulaJurídica;
				delete point.cedulaJurídica;
			}

			if (point.citasInscripción) {
				point.citasInscripcion = point.citasInscripción;
				delete point.citasInscripción;
			}

			point.cedulaJuridica = point.cedulaJuridica.replace(/,/g, '');
		});

		if (data.some(function(point) {
			return point.cedulaJuridica.length < 10;
		})) {
			console.log('Deleting ' + key);
			cache.DEL(key, function(err) {
				cb(err);
			});
		} else {
			console.log('Replacing ' + key);
			cache.SET(key, JSON.stringify(data), function(err) {
				cb(err);
			});
		}
	});
}, 1);

cache.KEYS('rnp-proxy.*.mercantil', function(err, keys) {
	if (err) {
		console.error(err);
		return process.exit(1);
	}

	queue.push(keys, function(err) {
		if (err) {
			console.error(err);
			process.exit(1);
		}
	});

	queue.drain = function(err) {
		cache.end();
	};
});
