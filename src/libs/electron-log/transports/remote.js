'use strict';







const { app } = require('electron');
const http = require('http');
const https = require('https');
const url = require('url');
const transform = require('electron-log/src/transform');

module.exports = remoteTransportFactory;

function remoteTransportFactory(electronLog, defaultUrl) {
	
	transport.client = { name: 'Mechvibes' };
	transport.depth = 6;
	transport.level = false;
	transport.requestOptions = {
		method: "LOG",
		headers: {
			'User-Agent': `Mechvibes/${app.getVersion()} (Electron/${process.versions.electron})`
		},
	};
	transport.url = defaultUrl;
	transport.onError = null;
	transport.transformBody = function (body) { return JSON.stringify(body) };

	
	
	

	
	

	
	transport.clear = function () {
		throw new Error('Not implemented');
		
		

		
		
		
	};

	return transport;

	function transport(message) {
		if (!transport.url) return;

		var data = transform.transform(message, [
			transform.removeStyles,
			transform.toJSON,
			transform.maxDepthFactory(transport.depth + 1),
		]);

		var body = transport.transformBody({
			client: transport.client,
			data: data,
			date: message.date.getTime(),
			level: message.level,
			variables: message.variables,
		});

		
		electronLog.variables.sender = 'log.remote › sending › ' + message.variables.sender;
		electronLog.logMessageWithTransports(
			{
				data: data,
				level: 'info',
			},
			[
				electronLog.transports.file,
			]
		);
		electronLog.variables.sender = 'main';

		var request = post(
			transport.url,
			transport.requestOptions,
			Buffer.from(body, 'utf8')
		);

		
		request.on('response', function (response) {
			
			var responseData = '';
			response.setEncoding('utf8');
			response.on('data', function (chunk) {
				responseData += chunk;
			});
			response.on('end', function () {
				if (response.statusCode !== 200) {
					electronLog.variables.sender = 'log.remote';
					electronLog.logMessageWithTransports(
						{
							data: [
								'received HTTP response code ' + response.statusCode
								+ ' from ' + transport.url,
							],
							level: 'warn',
						},
						[
							electronLog.transports.console,
							electronLog.transports.ipc,
							electronLog.transports.file,
						]
					);
					electronLog.variables.sender = 'main';
				}
			});
		});

		
		request.on('error', transport.onError || onError);

		
		function onError(error) {
			electronLog.variables.sender = 'log.remote';
			electronLog.logMessageWithTransports(
				{
					data: [
						'cannot send HTTP request to ' + transport.url,
						error,
					],
					level: 'warn',
				},
				[
					electronLog.transports.console,
					electronLog.transports.ipc,
					electronLog.transports.file,
				]
			);
			electronLog.variables.sender = 'main';
		}
	}
}

function post(serverUrl, requestOptions, body) {
	var urlObject = url.parse(serverUrl);
	var httpTransport = urlObject.protocol === 'https:' ? https : http;

	var options = {
		hostname: urlObject.hostname,
		port:     urlObject.port,
		path:     urlObject.path,
		method:   'POST',
		headers:  {},
	};

	Object.assign(options, requestOptions);

	options.headers['Content-Length'] = body.length;
	if (!options.headers['Content-Type']) {
		options.headers['Content-Type'] = 'application/json';
	}

	var request = httpTransport.request(options);
	request.write(body);
	request.end();

	return request;
}