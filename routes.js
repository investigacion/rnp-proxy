/*jshint node:true*/

'use strict';

var pathname = require('path');

module.exports = routes;

function routes(app, paths) {
	paths.forEach(function(path) {
		route(app, path);
	});
}

function route(app, path) {
	var controller;

	controller = require(__dirname + '/controllers/' + (pathname.basename(path) || 'index'));
	app.get(path, controller.get);
}
