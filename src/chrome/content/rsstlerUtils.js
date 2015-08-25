//
// This Source Code is subject to the terms of the Mozilla Public
// License, v. 2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/.
//
// Portions of the source code developed by Scott R. Turner are
// Copyright 2013 (C) to Scott R. Turner. 
//
// Portions of the source code developed by the Sage developers are
// Copyright (C) 2005 to the Sage developers, and subject to the
// terms of the Mozilla Public License, v. 1.1, as identified at the
// Sage extension home page http://sagerss.com.  
//  
var Cc = Components.classes;
var Ci = Components.interfaces;
var Cr = Components.results;
var Cu = Components.utils;

var RsstlerUtils = {

  VERSION : "0.1",
  
  USER_AGENT : "Mozilla/5.0 (rsstler)",

  PREF_BRANCH : "extensions.rsstler.",
  
  PREF_VERSION : "version",
  PREF_CSS_ENABLE : "userCss.enable",
  PREF_CSS_PATH : "userCss.path",
  PREF_ALLOW_ENCODED_CONTENT : "allowEncodedContent",
  PREF_RENDER_FEEDS : "renderFeeds",
  PREF_FEED_ITEM_ORDER : "feedItemOrder",
  PREF_GROUP_BY_FEED: "groupByFeed",
  PREF_FEED_DISCOVERY_MODE : "feedDiscoveryMode",
  PREF_FS_NAVNEXT : "fsNavNext",
  PREF_FS_NAVPREV : "fsNavPrev",
  PREF_FS_NAV_NEXT_PAGE: "fsNavNextPage",
  PREF_FS_NAVMARK : "fsNavMark",
  PREF_FS_NAVUNMARK : "fsNavUnmark",
  PREF_FS_OPENITEM: "fsOpenItem",
  PREF_LOG_LEVEL : "logLevel",
  PREF_AUTO_READ : "autoRead",
  PREF_ROOT: "rsstlerRoot",
  PREF_SHOW_LIST: "showListOnly",
  PREF_SHOW_UNREAD: "showUnreadOnly",
  PREF_USE_NEW_WINDOWS: "useNewWindows",
  PREF_CHECK_INTERVAL_ACTIVE: "checkIntervalActive",
  PREF_CHECK_INTERVAL_INACTIVE: "checkIntervalInactive",
  PREF_WAIT_FOR_RESPONSE: "waitForResponse",
  PREF_HIDE_EMPTY_FEEDS: "hideEmptyFeeds",
  PREF_HIDE_READ_FEEDS: "hideReadFeeds",
  PREF_PAGE_LIMIT: "pageLimit",
  PREF_STOP_CHECKING: "stopChecking",
  PREF_FEED_ITEM_SAVE_LIMIT: "feedItemSaveLimit",
  PREF_USE_ENDLESS_DISPLAY: "useEndlessDisplay",
  PREF_USE_FIXED_DISPLAY_HEADER: "useFixedDisplayHeader",
  PREF_SHOW_UPDATE_STATUS: "showUpdateStatus",
  PREF_ALWAYS_KEEP_LOCAL: "alwaysKeepLocal",
  PREF_USE_REMOTE_LAST_READ: "useRemoteLastRead",
  PREF_NAV_NEXT_FEED: "navNextFeed",
    
  FEED_SUMMARY_URI :    "rsstler://viewer/",

  NC_NS: "http://home.netscape.com/NC-rdf#",
  XUL_NS: "http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul",

  STATUS_UPDATE: "updated",
  STATUS_NO_UPDATE: "no-updated",
  STATUS_UNKNOWN: "unknown",
  STATUS_ERROR: "error",
  
  RSSTLER_ROOT_TITLE : "Rsstler Feeds",

  //
  //  Convert a string from Unicode into the given character set (aCharCode).
  //
  convertCharCodeFrom : function(aString, aCharCode) {
    var UConvID = "@mozilla.org/intl/scriptableunicodeconverter";
    var UConvIF  = Components.interfaces.nsIScriptableUnicodeConverter;
    var UConv = Components.classes[UConvID].getService(UConvIF);

    var tmpString = "";
    try {
      UConv.charset = aCharCode;
      tmpString = UConv.ConvertFromUnicode(aString);
    } catch(e) {
      tmpString = null;
    }
    return tmpString;
  },
  

  //
  //  Get the text from all the children of an HTML node and append it together.  Collects the
  //  text in the tree order of the HTML and strips whitespace off the front and back of the text
  //  of each child before appending it.
  //
  //  Currently unused.
  //
  getInnerText : function(aNode) {
    if(!aNode.hasChildNodes()) return "";
    
    var NodeFilter = Components.interfaces.nsIDOMNodeFilter;
  
    var resultArray = new Array();
    var walker = aNode.ownerDocument.createTreeWalker(aNode, NodeFilter.SHOW_CDATA_SECTION | NodeFilter.SHOW_TEXT, null, false);
    while(walker.nextNode()) {
      resultArray.push(walker.currentNode.nodeValue);
    }
    return resultArray.join('').replace(/^\s+|\s+$/g, "");
  },

  //
  //  Read file contents from a URI
  //
  loadText : function(aURI) {
    var  URI = Components.classes["@mozilla.org/network/standard-url;1"].createInstance(Components.interfaces.nsIURI);
    URI.spec = aURI;
  
    var IOService = Components.classes['@mozilla.org/network/io-service;1'].getService(Components.interfaces.nsIIOService);
    var channel = IOService.newChannelFromURI(URI);
    var stream  = channel.open();
    var scriptableStream = Components.classes['@mozilla.org/scriptableinputstream;1'].createInstance(Components.interfaces.nsIScriptableInputStream);
    scriptableStream.init(stream);

    var fileContents = scriptableStream.read(scriptableStream.available());

    scriptableStream.close();
    stream.close();

    return fileContents;
  },

  //
  //  The next two functions set and get preference values using the Mozilla preference service.
  //
  setPrefValue : function(aPref, aValue) {
    var prefService = Cc["@mozilla.org/preferences;1"].getService(Ci.nsIPrefBranch);
    switch (prefService.getPrefType(aPref)) {
      case Ci.nsIPrefBranch.PREF_INVALID:
        // throw "Invalid preference: " + aPref;
      case Ci.nsIPrefBranch.PREF_STRING:
        var string = Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);
        string.data = aValue;
        prefService.setComplexValue(aPref, Ci.nsISupportsString, string);
        break;
      case Ci.nsIPrefBranch.PREF_INT:
        aValue = parseInt(aValue);
        prefService.setIntPref(aPref, aValue);
        break;
      case Ci.nsIPrefBranch.PREF_BOOL:
        if (typeof(aValue) == "string") {
          aValue = (aValue == "true");
        }
        prefService.setBoolPref(aPref, aValue);
        break;
    }
  },

  getPrefValue : function(aPref) {
    var prefService = Cc["@mozilla.org/preferences;1"].getService(Ci.nsIPrefBranch);
    var prefValue = null;
    try {
    	switch (prefService.getPrefType(aPref)) {
    	case Ci.nsIPrefBranch.PREF_INVALID:
    		throw "Invalid preference: " + aPref;
    	case Ci.nsIPrefBranch.PREF_STRING:
    		prefValue = prefService.getComplexValue(aPref, Ci.nsISupportsString).data;
    		break;
    	case Ci.nsIPrefBranch.PREF_INT:
    		prefValue = prefService.getIntPref(aPref);
    		break;
    	case Ci.nsIPrefBranch.PREF_BOOL:
    		prefValue = prefService.getBoolPref(aPref);
    		break;
    	}
    	return prefValue;
    } catch (e) {
    	
    };
    return null;
  },
  
  //
  //  These functions set Rsstler preferences by putting them under extensions.rsstler.*
  //
  setRsstlerPrefValue : function(aRsstlerPref, aValue) {
    this.setPrefValue(this.PREF_BRANCH + aRsstlerPref, aValue);
  },

  getRsstlerPrefValue : function(aRsstlerPref) {
    return this.getPrefValue(this.PREF_BRANCH + aRsstlerPref);
  },
  
  getRsstlerRootFolderId : function() {
    return RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_ROOT);
  },

  //
  //  Get a bookmark folder ItemId given its name  
  //
  getFolderId: function(name) {
	  var options = rsstlerOverlay.hist.getNewQueryOptions();
	  var query = rsstlerOverlay.hist.getNewQuery();
	  query.setFolders([PlacesUtils.bookmarksMenuFolderId],1);
	  // 
	  // query.searchTerms doesn't work?
	  //
	  // query.searchTerms = RsstlerUtils.RSSTLER_ROOT_TITLE;
	  var qresult = rsstlerOverlay.hist.executeQuery(query, options);
	  var rootNode = qresult.root;
	  rootNode.containerOpen = true;

	  // iterate over the immediate children of rsstlerOverlay.folder and look for a title match
	  var result = null;
	  for (var i = 0; i < rootNode.childCount && !result; i ++) {
		  var node = rootNode.getChild(i);
		  if (node.title == name) {
			  result = node.itemId;
		  }
	  }

	  // close a container after using it!
	  rootNode.containerOpen = false;
	  return result;
  },
  
  hist: Cc["@mozilla.org/browser/nav-history-service;1"].getService(Ci.nsINavHistoryService),

  //
  //  Get a history result node from an item id
  //
  getNodeFromItemId: function(itemId) {
	  var query = RsstlerUtils.hist.getNewQuery();
	  var options = RsstlerUtils.hist.getNewQueryOptions();
	  query.setFolders([itemId], 1);
	  var result = RsstlerUtils.hist.executeQuery(query, options);
	  return result.root;
  },

  //
  //  Save the root folder Id as a preference.
  //  
  //
  setRsstlerRootFolderId : function(folderId) {
	  RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_ROOT, folderId);
  },
  
  addBookmarkToFolder : function(title, url, folderId) {
    var bookmarksService = Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Ci.nsINavBookmarksService);
    var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
    var bookmarkURI = ioService.newURI(url, null, null);
    var id = bookmarksService.insertBookmark(folderId, bookmarkURI, bookmarksService.DEFAULT_INDEX, title);
  },
  
  fcBundle: Cc["@mozilla.org/intl/stringbundle;1"].getService(Ci.nsIStringBundleService).createBundle("chrome://rsstler/locale/rsstler.properties"),
  
  //
  //  Get a string from the rsstler.properties string bundle
  //
  getRsstlerStr: function(msg, args) {
	  if (args){
		    args = Array.prototype.slice.call(arguments, 1);
		    return this.fcBundle.formatStringFromName(msg,args,args.length);
		  } else {
		    return this.fcBundle.GetStringFromName(msg);
		  }	  
  },
  
	//
	//  Make an HTML element
	//
	makeElement: function(aType, aClass, anId) {
		var doc = null; 
		if (typeof document == 'undefined' || document == null) {
			var windowMediator = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
			var win = windowMediator.getMostRecentWindow(null);
			doc = win.content.document;
		} else {
			doc = document;
		}
		var element = doc.createElement(aType);
		if (aClass != null) element.setAttribute("class", aClass);
		if (anId != null) element.setAttribute("id", anId);
		return element;
	},


  
};
