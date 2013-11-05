/*jshint node:true*/

'use strict';

var assert = require('assert');
var jsdom = require('jsdom');
var async = require('async');
var queue = require('./shared/queue');

exports.get = function(req, res) {
	var cedula, logger, cache, app;

	app = req.app;
	cache = app.get('cache');
	logger = app.get('logger');

	cedula = req.params.cedula;

	cache.get(key(), function(err, results) {
		if (err) {
			logger.error('[Mercantil] Error while getting value from cache for ' + cedula + ': ' + err);
			res.json(502, err);
			return;
		}

		if (results) {
			results = JSON.parse(results);

			if (results.length > 0) {
				logger.info('[Mercantil] Got results from cache for ' + cedula + '.');
				res.json(results);
			} else {
				res.send(404);
			}

			return;
		}

		scrape(app, cedula, function(err, results) {
			if (err) {
				logger.error('[Mercantil] Error while scraping ' + cedula + ': ' + err);
				res.json(502, err);
			} else if (results.length > 0) {
				res.json(results);
			} else {
				res.send(404);
			}
		});
	});
};

function key(cedula) {
	return 'rnp-proxy.' + cedula + '.mercantil';
}

function scrape(app, cedula, cb) {
	var logger, cache;

	cache = app.get('cache');
	logger = app.get('logger');

	logger.info('[Mercantil] Scraping cedula ' + cedula + '.');

	queue.scrape(function(err, requestor, next) {
		if (err) {
			cb(err);
			return next();
		}

		async.waterfall([
			function(cb) {
				logger.info('[Mercantil] Cedula ' + cedula + ': step 1');
				step1(requestor, cb);
			},

			function(cb) {
				logger.info('[Mercantil] Cedula ' + cedula + ': step 2');
				step2(requestor, cb);
			},

			function(cb) {
				logger.info('[Mercantil] Cedula ' + cedula + ': step 3');
				step3(requestor, cb);
			},

			function(cb) {
				logger.info('[Mercantil] Cedula ' + cedula + ': step 4');
				step4(requestor, cedula, cb);
			},

			function(cb) {
				logger.info('[Mercantil] Cedula ' + cedula + ': step 5');
				step5(requestor, cedula, cb);
			}
		], function(err, results) {
			if (!err) {
				logger.info('[Mercantil] Scraped ' + cedula + ' with ' + results.length + ' results.');
			}

			cache.set(key(cedula), JSON.stringify(results), 'EX', app.get('cache ttl'), function(err) {
				logger.error('[Mercantil] Error while setting value in cache: ' + err);
			});

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
	req.write('j_id53=j_id53&javax.faces.ViewState=j_id2&j_id53%3Aj_id98=j_id53%3Aj_id98');
	req.end();
}

function step2(requestor, cb) {
	var req;

	req = requestor({
		path: '/shopping/padronFisico.jspx'
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

function step3(requestor, cb) {
	var req;

	req = requestor({
		path: '/shopping/padronFisico.jspx',
		method: 'POST'
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
	req.write('AJAXREQUEST=_viewRoot&formBusqueda=formBusqueda&formBusqueda%3Aj_id161=1&formBusqueda%3Aj_id165=1&formBusqueda%3Aj_id260=&formBusqueda%3Aj_id262=&formBusqueda%3Aj_id264=&formBusqueda%3AmodalBMOpenedState=&formBusqueda%3AmodalFincasOpenedState=&formBusqueda%3AmodalNombramientosOpenedState=&formBusqueda%3AmodalAfectacionesOpenedState=&formBusqueda%3AmodalPoderesOpenedState=&formBusqueda%3AmodalAllOpenedState=&javax.faces.ViewState=j_id3&formBusqueda%3Aj_id167=formBusqueda%3Aj_id167&');
	req.end();
}

function step4(requestor, cedula, cb) {
	var req;

	req = requestor({
		path: '/shopping/padronFisico.jspx',
		method: 'POST'
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
	req.write('AJAXREQUEST=_viewRoot&formBusqueda=formBusqueda&formBusqueda%3Aj_id161=1&formBusqueda%3Aj_id165=1&formBusqueda%3Aj_id258=' + cedula + '&formBusqueda%3AmodalBMOpenedState=&formBusqueda%3AmodalFincasOpenedState=&formBusqueda%3AmodalNombramientosOpenedState=&formBusqueda%3AmodalAfectacionesOpenedState=&formBusqueda%3AmodalPoderesOpenedState=&formBusqueda%3AmodalAllOpenedState=&javax.faces.ViewState=j_id3&formBusqueda%3AbotonA=formBusqueda%3AbotonA&');
	req.end();
}

function step5(requestor, cedula, cb) {
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
			extractRows(html);
		});
	});

	req.on('error', function(err) {
		cb(err);
	});

	req.setTimeout(120 * 1000);
	req.write('AJAXREQUEST=_viewRoot&formBusqueda=formBusqueda&formBusqueda%3Aj_id161=1&formBusqueda%3Aj_id165=1&formBusqueda%3Aj_id258=' + cedula + '&formBusqueda%3AmodalBMOpenedState=&formBusqueda%3AmodalFincasOpenedState=&formBusqueda%3AmodalNombramientosOpenedState=&formBusqueda%3AmodalAfectacionesOpenedState=&formBusqueda%3AmodalPoderesOpenedState=&formBusqueda%3AmodalAllOpenedState=&javax.faces.ViewState=j_id3&cIdentificacion=1&formBusqueda%3AinventoryList%3A0%3AshowItem=formBusqueda%3AinventoryList%3A0%3AshowItem&numIdentificacion=' + cedula + '&nConsecIdentific=0&');
	req.end();

	extractRows = function(html) {
		jsdom.env(html, function(errs, window) {
			var t, req, button, document = window.document, results = [];

			t = function(node) {
				return node.textContent.trim();
			};

			Array.prototype.forEach.call(document.querySelectorAll('#formBusqueda\\:nombramientosList\\:tb tr'), function(row, i) {

				// The first row is a fake.
				if (0 === i) {
					return;
				}

				results.push({
					cedulaJurídica: t(row.children[0]).replace(/\-/g, ''),
					nombre: t(row.children[1]),
					citasInscripción: t(row.children[2]),
					nombradoComo: t(row.children[3])
				});
			});

			button = Array.prototype.reduce.call(document.getElementsByClassName('rich-datascr-button'), function(p, button) {
				if (button.textContent.trim() === '»') {
					return button;
				}

				return p;
			});

			window.close();

			if (button && !button.classList.contains('rich-datascr-button-dsbld')) {
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
						extractRows(html);
					});
				});

				req.write('AJAXREQUEST=_viewRoot&formBusqueda=formBusqueda&formBusqueda%3Aj_id161=1&formBusqueda%3Aj_id165=1&formBusqueda%3Aj_id258=' + cedula + '&formBusqueda%3AmodalBMOpenedState=&formBusqueda%3AmodalFincasOpenedState=&formBusqueda%3AmodalNombramientosOpenedState=&formBusqueda%3AmodalAfectacionesOpenedState=&formBusqueda%3AmodalPoderesOpenedState=&formBusqueda%3AmodalAllOpenedState=&javax.faces.ViewState=j_id3&ajaxSingle=formBusqueda%3AnombramientosList%3Ads3&formBusqueda%3AnombramientosList%3Ads3=fastforward&AJAX%3AEVENTS_COUNT=1&');
				req.end();
			} else {
				cb(null, results);
			}
		});
	};
}
