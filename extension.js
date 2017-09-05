/// <reference path="vscode.d.ts" />
/// <reference path="./lib/index.d.ts" />

"use strict";

//@ts-ignore
let vscode = require('vscode'),
    ext                     = require('./lib/VSCodeHelper'),
    uploader                = require('./lib/Uploader'),
    log                     = require('./lib/Log'),
    statusBar               = require('./lib/StatusBarManager'),
    localServer             = require('./lib/LocalServer'),
    UploadObjectGenerator   = require('./lib/UploadObjectGenerator');

log.setDebug(false);

/** How many ms in 1s */
const SECOND = 1000;

/** shortest time to record coding. 5000 means: All coding record divide by 5000  */
const CODING_SHORTEST_UNIT_MS = 5 * SECOND;

/** at least time to upload a watching(open) record */
const AT_LEAST_WATCHING_TIME = 5 * SECOND;

/**
 * means if you are not intently watching time is more than this number
 * the watching track will not be continuously but a new record
 */
const MAX_ALLOW_NOT_INTENTLY_MS = 60 * SECOND;

/** if you have time below not coding(pressing your keyboard), the coding track record will be upload and re-track */
const MAX_CODING_WAIT_TIME = 30 * SECOND;

/** If there a event onFileCoding with scheme in here, just ignore this event */
const INVALID_CODING_DOCUMENT_SCHEMES = [
	//there are will be a `onDidChangeTextDocument` with document scheme `git-index`
	//be emitted when you switch document, so ignore it
    'git-index',
    //since 1.9.0 vscode changed `git-index` to `git`, OK, they are refactoring around source control
    //see more: https://code.visualstudio.com/updates/v1_9#_contributable-scm-providers
    'git',
	//when you just look up output channel content, there will be a `onDidChangeTextDocument` be emitted
	'output',
	//This is a edit event emit from you debug console input box
    'input'
];

/** more thinking time from user configuration */
let moreThinkingTime = 0;
/** current active document*/
let activeDocument;
/** upload object generator instance */
let uploadObjectGenerator;
/** Tracking data, record document open time, first coding time and last coding time and coding time long */
let trackData = {
    openTime: 0,
    lastIntentlyTime: 0,
    firstCodingTime: 0,
    codingLong: 0,
    lastCodingTime: 0
};
let resetTrackOpenAndIntentlyTime = (now) => { trackData.openTime = trackData.lastIntentlyTime = now };

/**
 * Uploading open track data
 * @param {number} now
 */
function uploadOpenTrackData(now) {
    //If active document is not a ignore document
    if (!isIgnoreDocument(activeDocument)) {
        let longest = trackData.lastIntentlyTime + MAX_ALLOW_NOT_INTENTLY_MS + moreThinkingTime,
            long = Math.min(now, longest) - trackData.openTime,
            data = uploadObjectGenerator.gen('open', activeDocument, trackData.openTime, long);
        process.nextTick(() => uploader.upload(data));
    }
    resetTrackOpenAndIntentlyTime(now);
}

/** Uploading coding track data and retracking coding track data */
function uploadCodingTrackData() {
    //If active document is not a ignore document
    if (!isIgnoreDocument(activeDocument)) {
        let data = uploadObjectGenerator.gen('code', activeDocument, trackData.firstCodingTime,
            trackData.codingLong);
        process.nextTick(() => uploader.upload(data));
    }
    //Re-tracking coding track data
    trackData.codingLong =
        trackData.lastCodingTime =
        trackData.firstCodingTime = 0;    
}

/** Check a TextDocument, Is it a ignore document(null/'inmemory') */
function isIgnoreDocument(doc) {
    return !doc || doc.uri.scheme == 'inmemory';
}

/** Handler VSCode Event */
let EventHandler = {
    onIntentlyWatchingCodes: (textEditor) => {
        if (!textEditor || !textEditor.document)
            return;//Empty document
        let now = Date.now();
        //Long time have not intently watching document
        if (now > trackData.lastIntentlyTime + MAX_ALLOW_NOT_INTENTLY_MS + moreThinkingTime) {
            uploadOpenTrackData(now);
            //uploadOpenTrackDate has same expression as below:
            //resetTrackOpenAndIntentlyTime(now);
        } else {
            trackData.lastIntentlyTime = now;
        }
    },
    onActiveFileChange: (doc) => {
        log.d('onActiveFileChange: ', doc);
        let now = Date.now();
        // If there is a TextEditor opened before changed, should upload the track data
        if (activeDocument) {
            //At least open 5 seconds
            if (trackData.openTime < now - AT_LEAST_WATCHING_TIME) {
                uploadOpenTrackData(now);
            }
            //At least coding 1 second
            if (trackData.codingLong) {
                uploadCodingTrackData();
            }
        }
        activeDocument = ext.cloneTextDocumentObject(doc);
        //Retracking file open time again (Prevent has not retracked open time when upload open tracking data has been called)
        resetTrackOpenAndIntentlyTime(now);
        trackData.codingLong = trackData.lastCodingTime = trackData.firstCodingTime = 0;  
    },
    onFileCoding: (doc) => {
        log.d('onFileCoding: ', doc);

		//Ignore the invalid coding file schemes
		if (!doc || INVALID_CODING_DOCUMENT_SCHEMES.indexOf(doc.uri.scheme) >= 0 )
            return; 
       
        let now = Date.now();
        //If time is too short to calling this function then just ignore it 
        if (now - CODING_SHORTEST_UNIT_MS < trackData.lastCodingTime)
            return;
        //If is first time coding in this file, record time
        if (!trackData.firstCodingTime)
            trackData.firstCodingTime = now;
        //If too long time to recoding, so upload old coding track and retracking
        else if (trackData.lastCodingTime < now - MAX_CODING_WAIT_TIME - moreThinkingTime) {//30s
            uploadCodingTrackData()
            //Reset first coding time
            trackData.firstCodingTime = now;
        }
        trackData.codingLong += CODING_SHORTEST_UNIT_MS;
        trackData.lastCodingTime = now;
    }
}

/** when extension launch or vscode config change */
function updateConfigurations() {
     //CodingTracker Configuration
    let configurations = ext.getConfig('codingTracker'),
        uploadToken = String(configurations.get('uploadToken')),
        uploadURL = String(configurations.get('serverURL')),
        computerId = String(configurations.get('computerId')),
        mtt = parseInt(configurations.get('moreThinkingTime')),
        enableStatusBar = configurations.get('showStatus');

    // fixed wrong more thinking time configuration value
    if (isNaN(mtt)) mtt = 0;
    if (mtt < -15 * SECOND) mtt = -15 * SECOND;
    moreThinkingTime = mtt;

    uploadURL = (uploadURL.endsWith('/') ? uploadURL : (uploadURL + '/')) + 'ajax/upload';
    uploader.set(uploadURL, uploadToken);
    uploadObjectGenerator.setComputerId(computerId || `unknown-${require('os').platform()}`);
    localServer.updateConfig();
    statusBar.init(enableStatusBar);
}

function activate(context) {

    //Declare for add disposable inside easy
    let subscriptions = context.subscriptions;
    
    uploadObjectGenerator = new UploadObjectGenerator(vscode.workspace.rootPath);

    //Initialize local server(launch local server if localServer config is true)
    localServer.init(context);
    
    //Initialize Uploader Module
    uploader.init(context);
    //Update configurations first time
    updateConfigurations();

    //Listening workspace configurations change    
    vscode.workspace.onDidChangeConfiguration(updateConfigurations);

    //Tracking the file display when vscode open
    EventHandler.onActiveFileChange( (vscode.window.activeTextEditor || {}).document);

    //Listening vscode event to record coding activity    
    subscriptions.push(vscode.workspace.onDidChangeTextDocument(e => EventHandler.onFileCoding( (e || {}).document)  ));
    subscriptions.push(vscode.window.onDidChangeActiveTextEditor(e => EventHandler.onActiveFileChange((e || {}).document )  ));
    //the below event happen means you change the cursor in the document.
    //So It means you are watching so intently in some ways
    subscriptions.push(vscode.window.onDidChangeTextEditorSelection(e => EventHandler.onIntentlyWatchingCodes((e || {}).textEditor)  ));

    // Maybe I will add "onDidChangeVisibleTextEditors" in extension in next version
    // For detect more detailed editor information
    // But this event will always include debug-input box if you open debug panel one time
    
    // subscriptions.push(vscode.window.onDidChangeVisibleTextEditors(e => console.log('onDidChangeVisibleTextEditors', e)))
}
function deactivate() { 
    EventHandler.onActiveFileChange(null);
    localServer.dispose();
}


exports.activate = activate;
exports.deactivate = deactivate;