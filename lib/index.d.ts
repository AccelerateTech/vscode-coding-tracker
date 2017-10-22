type VCSCacheMap = {
	[key: string]: {
		cache: string;
		expiredTime: number;
	};
}

type LoggerFunction = (...fields) => void;
type Logger = {
	e: LoggerFunction;
	w: LoggerFunction;
	d: LoggerFunction;
	debugMode: boolean;
}
type UploadObject = {
	version: '4.0';
	token: string;
	type: string;
	time: string;
	long: number;
	/**
	 * File language
	 */
	lang: string;
	/**
	 * File name
	 */
	file: string;
	/**
	 * Project name
	 */
	proj: string;
	/**
	 * Computer ID
	 */
	pcid: string;

	/**
	 * Version Control System Information
	 */
	vcs_type: string;
	vcs_repo: string;
	vcs_branch: string;
	
	/**
	 * Line counts
	 */
	line: number;
	/**
	 * Character counts
	 */
	char: number;
	/**
	 * Reserved field 1
	 */
	r1: string;
	/**
	 * Reserved field 2
	 */
	r2: string;
}

type VSCodeTextDocument = {
	uri: VSCodeUri;
	fileName: string;
	isUntitled: boolean;
	languageId: string;
	version: number;
	isDirty: boolean;
	isClosed: boolean;
}
type VSCodeUri = {
	scheme: string;
	authority: string;
	path: string;
	query: string;
	fragment: string;
	fsPath: string;
};
