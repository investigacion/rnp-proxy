/*jshint node:true*/

'use strict';

var assert = require('assert');
var jsdom = require('jsdom');
var async = require('async');
var queue = require('./shared/queue');
var cedulas = require('./shared/cedulas');

exports.get = function(req, res) {
	cedulas.scrape('Morosidad', req.params.cedula, scrape, res);
};

function scrape(app, cedula, cb) {
	var logger, cache;

	cache = app.get('cache');
	logger = app.get('logger');

	logger.info('[Morosidad] Scraping cedula ' + cedula + '.');

	queue.scrape(function(err, requestor, next) {
		if (err) {
			cb(err);
			return next();
		}

		async.waterfall([
			function(cb) {
				logger.info('[Morosidad] Cedula ' + cedula + ': step 1');
				step1(requestor, cb);
			},

			function(cb) {
				logger.info('[Morosidad] Cedula ' + cedula + ': step 2');
				step2(requestor, cb);
			}
		], function(err, results) {
			if (!err) {
				logger.info('[Morosidad] Scraped ' + cedula + ' with ' + results.length + ' results.');
			}

			cb(err, results);
			next();
		});
	});
}

function step1(requestor, cb) {
	var req;

	req = requestor({
		path: '/shopping/consultaDocumentos/consultaMorosidadPJInterna.jspx'
	}, function(res) {
		assert.equal(res.statusCode, 200);

		res.on('readable', function() {
			res.read();
		});

		res.on('error', function(err) {
			cb(err);
		});

		res.on('end', function() {
			cb();
		});
	});

	req.on('error', function(err) {
		cb(err);
	});

	req.setTimeout(120 * 1000);
	req.end();
}

function step2(requestor, cedula, cb) {
	var req;

	req = requestor({
		path: '/shopping/consultaDocumentos/consultaMorosidadPJInterna.jspx',
		method: 'POST'
	}, function(res) {
		var html = '';

		assert.equal(res.statusCode, 200);

		res.on('readable', function() {
			html += res.read();
		});

		res.on('error', function(err) {
			cb(err);
		});

		res.on('end', function() {
			jsdom.env(html, function(errs, window) {
				var t, document, results = {};

				if (errs) {
					return cb(errs);
				}

				t = function(node) {
					return node.textContent.trim();
				};

				document = window.document;
				Array.prototype.forEach.call(document.querySelectorAll('#form > table:last-of-type tr'), function(row, i, rows) {

					// Skip the last row, which contains buttons.
					if ((i + 1) === rows.length) {
						return;
					}

					results[t(row.children[0])] = t(row.children[1]);
				});

				window.close();
				cb(null, results);
			});
		});
	});

	req.on('error', function(err) {
		cb(err);
	});

	req.setTimeout(120 * 1000);
	req.write('AJAXREQUEST=_viewRoot&form=form&form%3Atipo=' + cedula[0] + '&form%3Aclase=' + cedula.slice(1, 4) + '&form%3Aconsecutivo=' + cedula.slice(4) + '&javax.faces.ViewState=j_id3&form%3Aj_id167=form%3Aj_id167&');
	req.end();
}
