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
	var logger;

	logger = app.get('logger');
	logger.info('[Morosidad] [' + cedula + '] Scraping.');

	queue.scrape(function(err, requestor, next) {
		if (err) {
			cb(err);
			return next();
		}

		async.waterfall([
			function(cb) {
				logger.info('[Morosidad] [' + cedula + '] Step 1');
				step1(requestor, cb);
			},

			function(cb) {
				logger.info('[Morosidad] [' + cedula + '] Step 2');
				step2(requestor, cedula, cb);
			}
		], function(err, results) {
			if (!err) {
				logger.info('[Morosidad] [' + cedula + '] Scraped with ' + Object.keys(results).length + ' keys.');
			}

			cb(err, results);
			next();
		});
	});
}

function step1(requestor, cb) {
	requestor({
		url: 'https://www.rnpdigital.com/shopping/consultaDocumentos/consultaMorosidadPJInterna.jspx'
	}, function(err, res) {
		if (err) {
			return cb(err);
		}

		assert.equal(res.statusCode, 200);
		cb();
	});
}

function step2(requestor, cedula, cb) {
	requestor({
		url: 'https://www.rnpdigital.com/shopping/consultaDocumentos/consultaMorosidadPJInterna.jspx',
		method: 'POST',
		form: {
			AJAXREQUEST: '_viewRoot',
			form: 'form',
			'form:tipo': cedula[0],
			'form:clase': cedula.slice(1, 4),
			'form:consecutivo': cedula.slice(4),
			'javax.faces.ViewState': 'j_id3',
			'form:j_id170': 'form:j_id170'
		}
	}, function(err, res, html) {
		if (err) {
			return cb(err);
		}

		assert.equal(res.statusCode, 200);

		// TODO: Move this logic into the requestor function.
		if (-1 !== html.indexOf('<meta name="Location" content="./login.jspx" />')) {
			return cb(new Error('Session terminated for unknown reason.'));
		}

		jsdom.env(html, function(errs, window) {
			var t, rows, results = {};

			if (errs) {
				window.close();
				return cb(errs);
			}

			t = function(node) {
				return node.textContent.trim();
			};

			rows = window.document.querySelectorAll('#form > table:last-of-type tr');
			Array.prototype.forEach.call(rows, function(row, i, rows) {

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
}
