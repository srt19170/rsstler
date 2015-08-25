//  This Source Code is subject to the terms of the Mozilla Public
//  License, v. 2.0. If a copy of the MPL was not distributed with this
//  file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
//  Portions of the source code developed by Scott R. Turner are
//  Copyright 2013 (C) to Scott R. Turner. 
//
//  Portions of the source code developed by the Sage developers are
//  Copyright (C) 2005 to the Sage developers, and subject to the
//  terms of the Mozilla Public License, v. 1.1, as identified at the
//  Sage extension home page http://sagerss.com.  
var EXPORTED_SYMBOLS = ["rsstlerLogger", "RsstlerLogger"];

function rsstlerLogger() {
	this.init();
};

rsstlerLogger.prototype = {

		// logging level constants
		get LEVEL_ALL() { return 0x00; },
		get LEVEL_DEBUG() { return 0x01; },
		get LEVEL_INFO() { return 0x02; },
		get LEVEL_WARN() { return 0x03; },
		get LEVEL_ERROR() { return 0x04; },
		get LEVEL_FATAL() { return 0x05; },
		get LEVEL_OFF() { return 0x06; },
		get PREF_LOG_LEVEL() { return "extensions.rsstler.logLevel"; },

		_consoleService: Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService),

		init: function()
		{
			var pref = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefBranch);
			this._level = this.LEVEL_WARN;
			if (pref.prefHasUserValue(this.PREF_LOG_LEVEL)) {
				this.setLevel(pref.getIntPref(this.PREF_LOG_LEVEL));
			}
		},

		setLevel: function(aLevel)
		{
			this._level = aLevel;
		},

		debug: function(aMessage)
		{
			if (this._level <= this.LEVEL_DEBUG) {
				this._consoleService.logStringMessage("Rsstler [DEBUG]: " + aMessage);
			}
		},

		info: function(aMessage)
		{
			if (this._level <= this.LEVEL_INFO) {
				this._consoleService.logStringMessage("Rsstler [INFO]: " + aMessage);
			}
		},

		warn: function(aMessage)
		{
			if (this._level <= this.LEVEL_WARN) {
				this._consoleService.logStringMessage("Rsstler [WARN]: " + aMessage);
			}
		},

		error: function(aMessage)
		{
			if (this._level <= this.LEVEL_ERROR) {
				this._consoleService.logStringMessage("Rsstler [ERROR]: " + aMessage);
			}
		},

		fatal: function(aMessage)
		{
			if (this._level <= this.LEVEL_FATAL) {
				this._consoleService.logStringMessage("Rsstler [FATAL]: " + aMessage);
			}
		},
};

var RsstlerLogger = new rsstlerLogger();
