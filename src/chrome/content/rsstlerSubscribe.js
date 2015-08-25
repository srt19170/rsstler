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

//
//  We don't have to worry much about polluting the global namespace here because this is only
//  loaded in the subscribe dialog.
//
Components.utils.import("resource://rsstler/RsstlerFeeds.jsm");
Components.utils.import("resource://rsstler/rsstlerLogger.jsm");
Components.utils.import("resource://rsstler/rsstlerFeedParser.jsm");

var bmsvc;
//
//  Subscribe to a Feed
//

function initSubscribe() {
	bmsvc = Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Ci.nsINavBookmarksService);
}

//
//  Check the provided URL and if valid add it to our feeds.  If not, alert the user.
//  This is done asynchronously.  However, this function can return "false" to indicate
//  that the dialog should not be closed (e.g., empty input).
//
var acceptSubscribeHttpReq = null;
function acceptSubscribe() {
	// 
	//  Get the URL
	//
	var sfURL = document.getElementById("sfURL");
	if (sfURL == null) return true;  
	if (sfURL.value == "") {
		alert(RsstlerUtils.getRsstlerStr("emptyURL"));
		return false;
	}
	// RsstlerLogger.info("Checking URL: "+sfURL.value);
	//
	//  Start the validation process.
	//
	//  NOTE: This fails when executed asynchronously, due to a bug (?) in Firefox.
	//
	acceptSubscribeHttpReq = new XMLHttpRequest();
	acceptSubscribeHttpReq.onload = httpLoadedSubscribe;
	acceptSubscribeHttpReq.onerror = httpErrorSubscribe;
	acceptSubscribeHttpReq.ontimeout = httpTimeoutSubscribe;
	acceptSubscribeHttpReq.timeout = 2000;
	// RsstlerLogger.info("Onload = "+acceptSubscribeHttpReq.onload);
	RsstlerLogger.info("sfURL.value = "+sfURL.value);
	try {
		// true = asynch
		acceptSubscribeHttpReq.open("GET", sfURL.value);
		acceptSubscribeHttpReq.send(null);
	} catch(e) {
		acceptSubscribeHttpReq.abort();
		alert(RsstlerUtils.getRsstlerStr("invalidURL"));
		return false;
	}
	RsstlerLogger.info("request.status = "+acceptSubscribeHttpReq.status);
	return true;
}

function httpErrorSubscribe(e) {
	alert(RsstlerUtils.getRsstlerStr("invalidURL"));
}

function httpTimeoutSubscribe(e) {
	alert(RsstlerUtils.getRsstlerStr("timeout"));
}

//
//  Acceptance of the URL and addition to the feed is done as a side-effect
//  of a successful parse.
//
function httpLoadedSubscribe(e) {
	// RsstlerLogger.info("Entering httpLoadedSubscribe.");
	try {
		var httpReq = e.target;
		if (httpReq.status >= 200 && httpReq.status <= 299 && httpReq.responseText != null) {
			//  Get a feed parser
			var  feedParser = new rsstlerFeedParser();
			//  Make a temporary feed with a temporary id
			// var Feed = new Components.Constructor("@rsstler.mozdev.org/rsstler/feed;1", "rsstlerIFeed", "initId");
			var feed = new rsstlerFeed(1, httpReq.channel.originalURI.spec);
			var count = feedParser.parse(httpReq.responseText, feed);
			if (count > 0) {
				var rsstler_folder = RsstlerUtils.getRsstlerRootFolderId();
				var uri = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService).newURI(httpReq.channel.originalURI.spec, null, null);
				var itemId = bmsvc.insertBookmark(rsstler_folder, uri, -1, feed.getTitle());
				//
				//  Create a feed for this in rsstlerFeeds and then update it with the info we've just parsed.
				//
				var rfeed = RsstlerFeeds.createFeed(itemId, httpReq.channel.originalURI.spec);
				feed.setItemId(rfeed.getItemId());
				rfeed.update(feed);
				// alert(RsstlerUtils.getRsstlerStr("subscribedTo")+" "+rfeed.getTitle());
				
				// Close the dialog
				var winMain = document.getElementById("winMain");
				winMain.acceptDialog();
			}
		};
	} catch (e) {
		RsstlerLogger.info("Caught exception in httpLoadedSubscribe: "+e);
	}
}
	