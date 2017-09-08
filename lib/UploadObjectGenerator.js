var Path = require('path'),
	vscode = require('vscode');

var baseUploadObject = {
	version: '3.0',
	token: 'This value will be set up in Uploader module',
	type: '',
	time: '',
	long: 0,
	lang: '',
	file: '',
	proj: '',
	pcid: ''
};

module.exports = function (projectPath) {
	var uploadObject = cloneSimpleMapObject(baseUploadObject);
	uploadObject.proj = projectPath || 'unknown';

	this.setComputerId = computerId => uploadObject.pcid = computerId;

	this.gen = (type, activeDocument, time, long) => {
		var uri = activeDocument.uri;
		uploadObject.type = type;
		uploadObject.file = uri.scheme == 'file' ?
			vscode.workspace.asRelativePath(uri.fsPath) : uri.scheme;
		uploadObject.lang = activeDocument.languageId;
		uploadObject.time = time;
		uploadObject.long = long;
		return cloneSimpleMapObject(uploadObject);
	}

	function cloneSimpleMapObject(obj) { return Object.assign({}, obj); }
}