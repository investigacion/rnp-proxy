/*jshint node:true*/

'use strict';

var assert = require('assert');
var jsdom = require('jsdom');
var async = require('async');
var queue = require('./shared/queue');
var cedulas = require('./shared/cedulas');

exports.get = function(req, res) {
	cedulas.scrape('Mercantil', req.params.cedula, scrape, res);
};

function scrape(app, cedula, cb) {
	var logger, cache;

	cache = app.get('cache');
	logger = app.get('logger');

	logger.info('[Mercantil] [' + cedula + '] Scraping.');

	queue.scrape(function(err, requestor, next) {
		if (err) {
			cb(err);
			return next();
		}

		async.waterfall([
			function(cb) {
				logger.info('[Mercantil] [' + cedula + '] Step 1');
				step1(requestor, cb);
			},

			function(cb) {
				logger.info('[Mercantil] [' + cedula + '] Step 2');
				step2(requestor, cb);
			},

			function(cb) {
				logger.info('[Mercantil] [' + cedula + '] Step 3');
				step3(requestor, cb);
			},

			function(cb) {
				logger.info('[Mercantil] [' + cedula + '] Step 4');
				step4(logger, requestor, cedula, cb);
			}
		], function(err, results) {
			if (!err) {
				logger.info('[Mercantil] [' + cedula + '] Scraped with ' + results.length + ' results.');
			}

			cb(err, results);
			next();
		});
	});
}

function step1(requestor, cb) {
	var req;

	req = requestor({
		path: '/shopping/inventario.jspx',
		method: 'POST'
	}, function(res) {
		assert.equal(res.statusCode, 302);

		res.resume();

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
	req.write('j_id53=j_id53&javax.faces.ViewState=j_id2&j_id53%3Aj_id98=j_id53%3Aj_id98');
	req.end();
}

function step2(requestor, cb) {
	var req;

	req = requestor({
		path: '/shopping/padronFisico.jspx'
	}, function(res) {
		assert.equal(res.statusCode, 200);

		res.resume();

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

function step3(requestor, cb) {
	var req;

	req = requestor({
		path: '/shopping/padronFisico.jspx',
		method: 'POST'
	}, function(res) {
		assert.equal(res.statusCode, 200);

		res.resume();

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
	req.write('AJAXREQUEST=_viewRoot&formBusqueda=formBusqueda&formBusqueda%3Aj_id161=1&formBusqueda%3Aj_id165=1&formBusqueda%3Aj_id260=&formBusqueda%3Aj_id262=&formBusqueda%3Aj_id264=&formBusqueda%3AmodalBMOpenedState=&formBusqueda%3AmodalFincasOpenedState=&formBusqueda%3AmodalNombramientosOpenedState=&formBusqueda%3AmodalAfectacionesOpenedState=&formBusqueda%3AmodalPoderesOpenedState=&formBusqueda%3AmodalAllOpenedState=&javax.faces.ViewState=j_id3&formBusqueda%3Aj_id167=formBusqueda%3Aj_id167&');
	req.end();
}

function step4(logger, requestor, cedula, cb) {
	var req;

	req = requestor({
		path: '/shopping/padronFisico.jspx',
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

			// TODO: Move this logic into the requestor function.
			if (-1 !== html.indexOf('<meta name="Location" content="./login.jspx" />')) {
				return cb(new Error('Session terminated for unknown reason.'));
			}

			jsdom.env(html, function(errs, window) {
				var indexes;

				if (errs) {
					window.close();
					return cb(errs);
				}

				// Note that for some cedulas, for example 502950673, there are multiple sets of records for variant spellings of the person's name.
				indexes = window.document.querySelectorAll('#formBusqueda\\:inventoryList\\:tb > tr').length;

				logger.info('[Mercantil] [' + cedula + '] Got ' + indexes + ' name variant rows.');

				window.close();
				async.timesSeries(indexes, function(index, next) {
					logger.info('[Mercantil] [' + cedula + '] Extracting rows from name variant ' + index + '.');

					extractPerson(logger, requestor, cedula, index, next);
				}, function(err, results) {
					if (err) {
						return cb(err);
					}

					// Flatten the arrays of accumulated results.
					cb(null, results.reduce(function(results, set) {
						results.push.apply(results, set);

						return results;
					}, []));
				});
			});
		});
	});

	req.on('error', function(err) {
		cb(err);
	});

	req.setTimeout(120 * 1000);
	req.write('AJAXREQUEST=_viewRoot&formBusqueda=formBusqueda&formBusqueda%3Aj_id161=1&formBusqueda%3Aj_id165=1&formBusqueda%3Aj_id258=' + cedula + '&formBusqueda%3AmodalBMOpenedState=&formBusqueda%3AmodalFincasOpenedState=&formBusqueda%3AmodalNombramientosOpenedState=&formBusqueda%3AmodalAfectacionesOpenedState=&formBusqueda%3AmodalPoderesOpenedState=&formBusqueda%3AmodalAllOpenedState=&javax.faces.ViewState=j_id3&formBusqueda%3AbotonA=formBusqueda%3AbotonA&');
	req.end();
}

function extractPerson(logger, requestor, cedula, index, cb) {
	var req, extractRows;

	req = requestor({
		path: '/shopping/padronFisico.jspx',
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
			extractRows(html, []);
		});
	});

	req.on('error', function(err) {
		cb(err);
	});

	req.setTimeout(120 * 1000);
	req.write('AJAXREQUEST=_viewRoot&formBusqueda=formBusqueda&formBusqueda%3Aj_id161=1&formBusqueda%3Aj_id165=1&formBusqueda%3Aj_id258=' + cedula + '&formBusqueda%3AmodalBMOpenedState=&formBusqueda%3AmodalFincasOpenedState=&formBusqueda%3AmodalNombramientosOpenedState=&formBusqueda%3AmodalAfectacionesOpenedState=&formBusqueda%3AmodalPoderesOpenedState=&formBusqueda%3AmodalAllOpenedState=&javax.faces.ViewState=j_id3&cIdentificacion=1&formBusqueda%3AinventoryList%3A' + index + '%3AshowItem=formBusqueda%3AinventoryList%3A' + index + '%3AshowItem&numIdentificacion=' + cedula + '&nConsecIdentific=' + index + '&');
	req.end();

	extractRows = function(html, results) {
		jsdom.env(html, function(errs, window) {
			var t, req, button, document, count = 0;

			logger.info('[Mercantil] [' + cedula + '] Extracting rows.');

			if (errs) {
				return cb(errs);
			}

			document = window.document;

			t = function(node) {
				return node.textContent.trim();
			};

			Array.prototype.forEach.call(document.querySelectorAll('#formBusqueda\\:nombramientosList\\:tb tr'), function(row, i) {

				// The first row is a fake.
				if (0 === i) {
					return;
				}

				count++;
				results.push({
					cedulaJurídica: t(row.children[0]).replace(/\-/g, ''),
					nombre: t(row.children[1]),
					citasInscripción: t(row.children[2]),
					nombradoComo: t(row.children[3])
				});
			});

			logger.info('[Mercantil] [' + cedula + '] Extracted ' + count + ' rows, total for person name variant at ' + results.length + '.');

			Array.prototype.slice.call(document.querySelectorAll('#formBusqueda\\:nombramientosList\\:footer .rich-datascr-button'), 0).some(function(b) {
				if (b.textContent.trim() === '»') {
					button = b;
					return true;
				}
			});

			window.close();

			if (button && -1 === button.className.indexOf('rich-datascr-button-dsbld')) {
				logger.info('[Mercantil] [' + cedula + '] Moving to next rows page.');

				req = requestor({
					path: '/shopping/padronFisico.jspx',
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
						extractRows(html, results);
					});
				});

				req.write('AJAXREQUEST=_viewRoot&formBusqueda=formBusqueda&formBusqueda%3Aj_id161=1&formBusqueda%3Aj_id165=1&formBusqueda%3Aj_id258=' + cedula + '&formBusqueda%3AmodalBMOpenedState=&formBusqueda%3AmodalFincasOpenedState=&formBusqueda%3AmodalNombramientosOpenedState=&formBusqueda%3AmodalAfectacionesOpenedState=&formBusqueda%3AmodalPoderesOpenedState=&formBusqueda%3AmodalAllOpenedState=&javax.faces.ViewState=j_id3&ajaxSingle=formBusqueda%3AnombramientosList%3Ads3&formBusqueda%3AnombramientosList%3Ads3=fastforward&AJAX%3AEVENTS_COUNT=1&');
				req.end();
			} else {
				logger.info('[Mercantil] [' + cedula + '] Extracted last row page.');

				cb(null, results);
			}
		});
	};
}
