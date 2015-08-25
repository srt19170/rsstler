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
Components.utils.import("resource://rsstler/RsstlerFeeds.jsm");
Components.utils.import("resource://rsstler/rsstlerLogger.jsm");
// Components.utils.import("resource://services  -sy  nc/main.js");

var rsstlerUI = {

    hist: Cc["@mozilla.org/browser/nav-history-service;1"].getService(Ci.nsINavHistoryService),
    bmsvc: Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Ci.nsINavBookmarksService),
    currentFeed: null,         /* The feed currently being displayed (if a feed) */
    currentFeedId: null,       /* Item Id of the current feed, which might be a folder */
    currentFeedItems: null,    /* The sorted array of displayed feed items */
    nextItemIndex: 0,          /* Index in currentFeedItems of the last item displayed */
    document: null, 	       /* The HTML document for the Rsstler page */
    lastUpdateTime: -1,        /* When RsstlerFeeds last updated the feeds.  -1 = unknown, 0 = in process */
    updateTimer: null,         /* The timer that updates the status of the feeds */
    feedUpdating: "",          /* The feed currently being updated */

    DEFAULT_CSS: "chrome://rsstler/skin/rsstler.css",


    //
    // An observer for RsstlerFeeds events
    //
    rsstlerFeedsObserver: {
	count: 0,
	observe: function(subject, topic, data) {
	    if (topic === "rsstlerWorking") {
		this.count++;
		var spinner = document.getElementById("spinner");
		spinner.setAttribute("visible","true");
	    } else if (topic === "rsstlerDone") {
		this.count--;
		if (this.count < 1) {
		    this.count = 0;
		    var spinner = document.getElementById("spinner");
		    spinner.removeAttribute("visible");
		};
	    } else if (topic === "rsstlerBookmarkChange") {
		rsstlerUI.drawFeedsTree();
	    } else if (topic === "rsstlerRefresh") {
		if (data != null) {
		    // RsstlerLogger.info("updateTreeDom from rsstlerFeedsObserver: "+data);
		    TreeView.updateTreeDOM(data);
		} else {
		    rsstlerUI.drawFeedsTree();
		}
	    } else if (topic === "rsstlerCheckDone") {
		rsstlerUI.lastUpdateTime = (new Date()).getTime();
	    } else if (topic === "rsstlerCheckStart") {
		rsstlerUI.lastUpdateTime = 0;
	    } else if (topic == "rsstlerCheckFeed") {
		rsstlerUI.feedUpdating = data;
	    }
	}
    },

    //
    //  This adds the alternate CSS style sheet, if the user has specified one.
    //
    addUserCss: function() {
	var CssEnable = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_CSS_ENABLE);
	var CssPath = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_CSS_PATH);
	if (CssEnable && CssPath) {
	    try {
		//  Convert file path to a URI
		CssPath = "file:///" + CssPath.replace(/\\/g,'/');
		// RsstlerLogger.info("Adding user style sheet: "+CssPath);
		var head = document.getElementsByTagName("head")[0];
		var userStyle = RsstlerUtils.makeElement("link", "", "userStyle");
		userStyle.setAttribute("type","text/css");
		userStyle.setAttribute("rel", "stylesheet");
		userStyle.setAttribute("href",CssPath);
		//  Remove any old user stylesheet
		var old = document.getElementById("userStyle");
		if (old != null) head.removeChild(old);
		//  And put in the new
		head.appendChild(userStyle);
	    } catch(e) {
		RsstlerLogger.info("Error trying to load user stylesheet: "+e);
	    }
	}
    },

    //
    //  Creates the HTML for the Feeds tree
    //
    drawFeedsTree: function () {
	var tv = document.getElementById("treeview");
	rsstlerUI.clearElement(tv);
	//  Get the folder for the root (which may have changed) 
	var top = TreeView.makeHTML(RsstlerUtils.getRsstlerRootFolderId());
	if (top) tv.appendChild(top);
    },

    //
    //  This is adapted from http://ejohn.org/blog/javascript-pretty-date/ 
    //  Copyright (c) 2011 John Resig (ejohn.org)
    //  Licensed under the MIT and GPL licenses.
    //
    prettyDate: function (time) {
	var date = new Date(time);
	var diff = (((new Date()).getTime() - date.getTime()) / 1000);
	var day_diff = Math.floor(diff / 86400);

	if ( isNaN(day_diff) || day_diff < 0) return "Unknown";

	return day_diff == 0 && (
	    diff < 30 && "just now" ||
		diff < 60 && "30 secs ago" || 
		diff < 120 && "1 minute ago" ||
		diff < 3600 && Math.floor( diff / 60 ) + " minutes ago" ||
		diff < 7200 && "1 hour ago" ||
		diff < 86400 && Math.floor( diff / 3600 ) + " hours ago") ||
	    day_diff == 1 && "Yesterday" ||
	    day_diff < 7 && day_diff + " days ago" ||
	    day_diff < 31 && Math.ceil( day_diff / 7 ) + " weeks ago" ||
	    date.toLocaleString();
    },

    //
    //  Init is called from the XUL file at the page onload
    //
    init: function() {
	//  Add user stylesheet, if there is one.
	rsstlerUI.addUserCss();
	//
	//  Apply initial settings
	//
	rsstlerUI.applySettings();
	//
	//  Draw the treeview of feeds
	//
	rsstlerUI.drawFeedsTree();
	//
	//  Update buttons
	//
	rsstlerUI.updateFullOrTitles();
	rsstlerUI.updateAllOrUnread();
	//  
	//  Set up the keypress and scrolling handlers
	//
	document.addEventListener("keypress", rsstlerUI.handleKeyPress, false);
	var feedDisplay = document.getElementById("feedDisplay");
	feedDisplay.addEventListener("scroll", rsstlerUI.monitorScroll, false);
	//
	//  Add RsstlerFeeds observer
	//
	var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
	observerService.addObserver(rsstlerUI.rsstlerFeedsObserver, "rsstlerWorking", false);
	observerService.addObserver(rsstlerUI.rsstlerFeedsObserver, "rsstlerDone", false);
	observerService.addObserver(rsstlerUI.rsstlerFeedsObserver, "rsstlerRefresh", false);
	observerService.addObserver(rsstlerUI.rsstlerFeedsObserver, "rsstlerCheckFeed", false);
	observerService.addObserver(rsstlerUI.rsstlerFeedsObserver, "rsstlerCheckStart", false);
	observerService.addObserver(rsstlerUI.rsstlerFeedsObserver, "rsstlerCheckDone", false);
	observerService.addObserver(rsstlerUI.rsstlerFeedsObserver, "rsstlerBookmarkChange", false);
	//
	//  Save the content document
	//
	var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
	var mainWindow = wm.getMostRecentWindow("navigator:browser");
	rsstlerUI.document = mainWindow.document;
	//
	//  Add the context menu listener
	//
	var contextMenu = rsstlerUI.document.getElementById("contentAreaContextMenu");
	if (contextMenu) contextMenu.addEventListener("popupshowing", rsstlerUI.handlePopup, false);
	//
	//  Localize buttons
	//
	var markAllAsRead = document.getElementById("markAllAsRead");
	markAllAsRead.textContent = RsstlerUtils.getRsstlerStr("markAllAsRead");
	var subButton = document.getElementById("subscriptionButton");
	subButton.textContent = RsstlerUtils.getRsstlerStr("subscriptionButton");
	var helpButton = document.getElementById("openHelp");
	helpButton.textContent = RsstlerUtils.getRsstlerStr("openHelp");
	//
	//  Let RsstlerFeeds know that the UI is open
	//
	RsstlerFeeds.openUI();
	//
	//  Start the timer to refresh the update status (every second)
	//
	var callback = {};
	callback.notify = function() {
	    rsstlerUI.updateStatus();
	};
	rsstlerUI.updateTimer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
	rsstlerUI.updateTimer.initWithCallback(callback, 1000, Ci.nsITimer.TYPE_REPEATING_SLACK);
	//
	//  See if we've been passed in a URL; if so we're being asked to subscribe.  All we have to 
	//  do in this case is subscribe to the bookmark (we'll assume the feed is valid).  Unfortunately we 
	//  don't have a title for the bookmark!  The bookmark listener should handle adding the feed...
	//
	var href = document.location.href;
	if (/\?feed=.*$/.test(href)) {
	    var feedURL = decodeURIComponent((document.location.href).replace(/.*\?feed=(.*)$/,"$1"));
	    var rsstler_folder = RsstlerUtils.getRsstlerRootFolderId();
	    var uri = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService).newURI(feedURL, null, null);
	    var itemId = rsstlerUI.bmsvc.insertBookmark(rsstler_folder, uri, -1, feedURL);
	}
	
	RsstlerLogger.info("UI opened.");
    },

    uninit: function() {
	RsstlerLogger.info("Closing UI.");
	//
	//  Remove the keypress listener -- probably unnecessary
	//
	document.removeEventListener("keypress", rsstlerUI.handleKeyPress, false);
	//
	//  Remove the context menu listener -- also probably unnecessary
	//
	var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
	var mainWindow = wm.getMostRecentWindow("navigator:browser");
	var contextMenu = mainWindow.document.getElementById("contentAreaContextMenu");
	if (contextMenu) contextMenu.removeEventListener("popupshowing", rsstlerUI.handlePopup, false);
	//
	//  Remove RsstlerFeeds observer
	//
	var observerService = Cc["@mozilla.org/observer-service;1"].getService(Ci.nsIObserverService);
	observerService.removeObserver(rsstlerUI.rsstlerFeedsObserver, "rsstlerRefresh");
	observerService.removeObserver(rsstlerUI.rsstlerFeedsObserver, "rsstlerWorking");
	observerService.removeObserver(rsstlerUI.rsstlerFeedsObserver, "rsstlerDone");
	observerService.removeObserver(rsstlerUI.rsstlerFeedsObserver, "rsstlerCheckFeed");
	observerService.removeObserver(rsstlerUI.rsstlerFeedsObserver, "rsstlerCheckStart");
	observerService.removeObserver(rsstlerUI.rsstlerFeedsObserver, "rsstlerCheckDone");
	observerService.removeObserver(rsstlerUI.rsstlerFeedsObserver, "rsstlerBookmarkChange");
	//
	//  Remove update timer
	//
	if (rsstlerUI.updateTimer) rsstlerUI.updateTimer.cancel();
	//
	//  Force bookmarks update
	//
	// Weave.Service.errorHandler.sy  ncAndReportErrors();
	//
	//  Let RsstlerFeeds know that the UI is closed
	//
	RsstlerFeeds.closeUI();
    },
    
    updateStatus: function () {
	var updateStatus = document.getElementById("updateStatus");
	var text = RsstlerUtils.getRsstlerStr("updateUnknown");
	if (rsstlerUI.lastUpdateTime == 0) {
	    text = RsstlerUtils.getRsstlerStr("updateInProgress") + " " + rsstlerUI.feedUpdating;
	} else if (rsstlerUI.lastUpdateTime > 0) {
	    text = RsstlerUtils.getRsstlerStr("lastUpdate") + " " + rsstlerUI.prettyDate(rsstlerUI.lastUpdateTime);
	};
	updateStatus.textContent = text;
    },
    
    //
    //  This gets called right before the context menu is shown.  We reveal the appropriate menu
    //  items depending upon where the user clicked.
    //
    handlePopup: function(event) {
	var triggerClass = event.target.triggerNode.getAttribute("class");
	// RsstlerLogger.info("handlePopup, class = "+trigger.getAttribute("class"));
	if (triggerClass == "leafTitle" || triggerClass === "folderTitle") {
	    var rsstlerDeleteFeed = rsstlerUI.document.getElementById("rsstlerDeleteFeed");
	    var rsstlerOpenInTab = rsstlerUI.document.getElementById("rsstlerOpenInTab");
	    var rsstlerSeparator = rsstlerUI.document.getElementById("rsstlerSeparator");
	    rsstlerDeleteFeed.hidden = false;
	    rsstlerOpenInTab.hidden = false;
	    rsstlerSeparator.hidden = false;
	};
    },
    
    //
    //  This is the function that is called by the context menu "Delete Rsstler Feed" item.  It
    //  expects to find the obj.itemId to know what bookmark to delete.
    //
    cmDelete: function(obj) {
	//
	//  We should just be able to delete the bookmark and let the bookmark listener update the display
	//
	if (obj != null && obj.getAttribute("itemId") != null)
	    // RsstlerLogger.info("obj.itemId = "+obj.getAttribute("itemId"));
	    rsstlerUI.bmsvc.removeItem(obj.getAttribute("itemId"));
    },

    //
    //  This is the function that is called by the context menu "Go to Feed" item.  It
    //  expects to find the obj.itemId to know what bookmark to open.  The "right" thing 
    //  here might be to open the top-level website...?
    //
    cmOpenInTab: function(obj) {
	//
	//  We should just be able to delete the bookmark and let the bookmark listener update the display
	//
	if (obj != null && obj.getAttribute("itemId") != null) {
	    // RsstlerLogger.info("obj.itemId = "+obj.getAttribute("itemId"));
	    /*				var nsIURI = rsstlerUI.bmsvc.getBookmarkURI(obj.getAttribute("itemId"));
					var host = nsIURI.host;
					var scheme = nsIURI.scheme;
	    */
	    var feed = RsstlerFeeds.getFeedById(obj.getAttribute("itemId"));
	    // alert("Host = "+host+" scheme = "+scheme);
	    // Add tab, then make active
	    if (feed != null && feed.getLink() != null) {
		var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
		var mainWindow = wm.getMostRecentWindow("navigator:browser");
		mainWindow.gBrowser.selectedTab = mainWindow.gBrowser.addTab(feed.getLink());
	    }
	};
    },

    //
    //  Notify observers of an event
    //
    notifyObservers: function(aEvent, aValue) {
	var observerService = Cc["@mozilla.org/observer-service;1"]
	    .getService(Ci.nsIObserverService);
	observerService.notifyObservers(null, aEvent, aValue);
    },

    //
    //  Helper functions for rendering a feed (displaying it in feedDisplay)
    //

    //
    //  Remove HTML leaving just the text.
    //
    htmlToText : function(aStr) {
	var parserUtils = Components.classes["@mozilla.org/parserutils;1"].getService(Components.interfaces.nsIParserUtils);
	var txt = parserUtils.convertToPlainText(aStr, null, 0);
	return txt;
    },

    //
    //  Sanitize content
    //
    //  This is based upon parserUtils.sanitize.  Note this returns a document, not a fragment!
    //
    sanitize: function(content) {
	var parserUtils = Components.classes["@mozilla.org/parserutils;1"].getService(Components.interfaces.nsIParserUtils);
	var sanitized = parserUtils.sanitize(content, parserUtils.SanitizerAllowStyle);
	return sanitized;
    },
    
    //
    //  This is used to create a unique id so that the iframe can communicate back to the browser.
    //
    uniqueID: 0,
    
    //
    //  NOTE TO REVIEWERS: The following code takes the RSS feed content and puts it into an <iframe type=content>.
    //  This is to address the security concern with untrusted code, per 
    //  https://developer.mozilla.org/en-US/docs/Displaying_web_content_in_an_extension_without_security_issues.
    //
    //  This version uses a dataURI and a type=content iframe.
    //
    makeContentIframe: function(feedItem) {
	var content = feedItem.getContent();
	//  Force links to open in a new window/tab
	if (RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_USE_NEW_WINDOWS)) {
	    content = content.replace(/<a /g,'<a target="_blank" ');
	};
	//
	//  If there's an enclosure, add the HTML for that to the end of the feed item.
	//
	//  <enclosure url="http://example.com/file.mp3" length="123456789" type="audio/mpeg" />
	//
	//  The standard recommends only one enclosure per feed item.  Automatically downloading
	//  this is dubious, so we'll just turn it into a link.
	//
	if (feedItem.hasEnclosure()) {
	    content += "<div class='enclosure'><a target='_blank' href='"+feedItem.getEnclosure().getLink()+"'>"+
		RsstlerUtils.getRsstlerStr("enclosure")+": <img src='"+
		"moz-icon://dummy?size=64&contentType="+feedItem.getEnclosure().getMimeType()+"'/>";
	    if (feedItem.getEnclosure().getDescription() != null) {
		content += feedItem.getEnclosure().getDescription();
	    }
	    if (feedItem.getEnclosure().getSize() != null) {
		content += "(" + feedItem.getEnclosure().getSize()+")";
	    };
	    content += "</div>";
	};
	//
	//  Try to fix relative URLs lacking an http: prefix
	//
	content = content.replace(/"\/\//g,'"http://');
	content = content.replace(/'\/\//g,"'http://");
	var description = RsstlerUtils.makeElement("iframe","iframeDesc","iframe"+rsstlerUI.uniqueID);
	//  Force it to be content type
	description.setAttribute("type", "content");
	//  Seamless display  
	description.setAttribute("seamless","true");
	//  Initially set height to zero to minimize UI thrashing
	description.style.height = "0px";
	//  Gets hidden in list mode
	description.setAttribute("fullItem", "true");
	//
	//  Test button
	//
	// content =  '<button onclick="RsstlerLogger.info(\'Test\');">Click me</button>' + content;

	//
	// The only reliable way to get content into the iframe is to encode it in the src attribute.
	// This is inefficient because it forces an encode<->decode round-trip, but the other solutions
	// (such as using innerHTML) have other problems.
	//
	content = '<html><head><style type=\'text/css\'>img {max-width: 100%;}</style></head><body '+
	    'onload=" '+
	    //
	    //  This postMessage sends the iframe's height back to the parent so it can set the height 
	    //  of the iframe to fit everything without scrolling.
	    //
	    'parent.postMessage(\'iframe'+rsstlerUI.uniqueID+':\'+document.body.scrollHeight, \'*\');' +
	    '">'+
	    '<div id=\'content\' '+
	    ' style=\'font-family: arial,sans-serif; font-size: 13px; max-width: 100% !important; overflow: hidden;\'>' + 
	    content + '</div></body></html>';
	description.setAttribute("src","data:text/html;charset=utf-8," + encodeURIComponent(content));

	//
	//  Need to add event listeners to the iFrame contentDocument, but we can't do that until it exists, 
	//  which doesn't happen until it is loaded.  We need to add a keypress event listener, so we can
	//  push the handling of keypresses when over the iframe up to the UI.
	//
	description.addEventListener("load",
				     function () {
					 //
					 //  Push keypress events up to the UI
					 //
					 this.contentDocument.addEventListener("keypress", rsstlerUI.handleKeyPress, true);
				     }, true);
	return description;
    },

    //
    //  Format a single feed item for display.
    //
    renderFeedItem: function(feedItem) {
	var item = RsstlerUtils.makeElement("div","item");
	if (feedItem.getRead()) item.setAttribute("readItem","true");
	var itemTitle = RsstlerUtils.makeElement("span","itemTitle");
	var itemTitleLink = RsstlerUtils.makeElement("a");
	//
	//  The title is a link to the actual article, and is the first thing in the item.
	//
	rsstlerUI.setURIAttributeSafe(feedItem.getFeed().getFeedURI(), itemTitleLink, "href", feedItem.getLink());
	//
	//   Open in a new window (or tab) to avoid overwriting the Rsstler tab.
	//
	if (RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_USE_NEW_WINDOWS)) {
	    itemTitleLink.target = "_blank";
	};
	itemTitleLink.appendChild(document.createTextNode(feedItem.getTitle()));
	itemTitle.appendChild(itemTitleLink);
	item.appendChild(itemTitle);

	//
	//  Process the publication date into something readable.
	//
	if (feedItem.hasPubDate()) {
	    var pubdate = RsstlerUtils.makeElement("div","itemPubDate");
	    // var formattedDate = new Date(feedItem.getPubDate()).toLocaleString();
	    var formattedDate = rsstlerUI.prettyDate(feedItem.getPubDate());
	    //  Link to alert timestamps.
	    //				var alertTitleLink = RsstlerUtils.makeElement("a","itemPubDate");
	    //				alertTitleLink.setAttribute("href","javascript:alert('Feed lastRead: "+feedItem.getFeed().getLastReadDate()+
	    //												   " item pubDate: "+feedItem.getPubDate()+" item isSaved: "+
	    //												   feedItem.isSaved()+"');");
	    //				alertTitleLink.appendChild(document.createTextNode(formattedDate));
	    //				item.appendChild(alertTitleLink);
	    
	    pubdate.appendChild(document.createTextNode(formattedDate));
	    item.appendChild(pubdate);
	}

	//
	//  Feed author.  If the feed doesn't have an author, we fill in the feed title.
	//
	if (feedItem.hasAuthor() || feedItem.getFeed().getTitle()) {
	    var author = RsstlerUtils.makeElement("div", "itemAuthor");
	    //  Gets hidden in list mode
	    author.setAttribute("fullItem", "true");
	    var authorText = "by";
	    if (feedItem.getAuthor() != null) {
		authorText += " " + feedItem.getAuthor();
	    }
	    if (feedItem.getFeed().getTitle() != null) {
		authorText += " (" + feedItem.getFeed().getTitle() + ")";
	    }
	    author.appendChild(document.createTextNode(authorText));
	    item.appendChild(author);
	}

	if (feedItem.hasContent()) {
	    //
	    //  NOTE TO REVIEWERS:  The feedItem content is untrusted.  The following function has the 
	    //  job of creating an HTML element (e.g., an <iframe>) that can display the content securely.
	    //
	    var description = rsstlerUI.makeContentIframe(feedItem);
	    //
	    //   Now add the description to the item.
	    //
	    item.appendChild(description);
	    //
	    //   And increment the uniqueID
	    //
	    rsstlerUI.uniqueID++;
	}

	//
	//  Save the feedItem and index on the item so that we can use it later when we want to mark the feedItem read, etc.
	//
	item.feedItem = feedItem;
	return item;
    },

    //
    //  We cache these values so we can use a single comparator function and not look up the prefs every comparison.
    //  
    newestFirst: true,
    groupByFeed: false,

    feedItemComparator: function(feedItem1, feedItem2) {
	//
	//  If group by feed is on, then we sort by the (arbitrary) itemId order
	//
	if (rsstlerUI.groupByFeed && feedItem1.getFeed().getItemId() != feedItem2.getFeed().getItemId()) {
	    return (feedItem1.getFeed().getItemId() - feedItem2.getFeed().getItemId());
	} else if (rsstlerUI.newestFirst) {
	    return (feedItem2.getPubDate() - feedItem1.getPubDate());
	} else {
	    return (feedItem1.getPubDate() - feedItem2.getPubDate()); 
	};
	return 0;
    },

    //
    //  Display the next page of results
    //
    //  If you're using endless display, then we just delete the final item, stuff in more items, and then
    //  add back the final item.  If you're paging, then we delete everything.
    //
    displayNextPage: function () {
	//
	//  May be nothing left to display
	//
	if (rsstlerUI.nextItemIndex >= rsstlerUI.currentFeedItems.length) return;
	var feedDisplay = document.getElementById("feedDisplay");
	var endless = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_USE_ENDLESS_DISPLAY);
	//  This removes the last item (actually two items)
	if (feedDisplay.lastChild.id === "fillerSpace") feedDisplay.removeChild(feedDisplay.lastChild);  // <br> that creates space at end of page
	if (feedDisplay.lastChild.id === "itemTerminator") feedDisplay.removeChild(feedDisplay.lastChild);  // <div id="itemTerminator">
	//  Now if we're paging, remove all "items" from the display
	if (!endless) {
	    var children = feedDisplay.childNodes;
	    //  Go through the array backwards so that deleting nodes doesn't break the loop
	    if (children.length > 0)
		for (var i = children.length-1; i >= 0; i--) {
		    if (children[i].nodeType == Node.ELEMENT_NODE && 
			children[i].tagName.toUpperCase() == "DIV" &&
			children[i].className.toUpperCase() == "ITEM") feedDisplay.removeChild(children[i]);
		}
	};
	//
	//  Now add something for each item in the feed.  If we're doing infinite scrolling, we
	//  don't want to reset _items, because we haven't actually deleted anything.
	//
	if (!rsstlerUI._items || !endless) rsstlerUI._items = new Array();
	var pageLimit = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_PAGE_LIMIT) + rsstlerUI.nextItemIndex + 1;
	var i;
	var firstItem = null;
	var firstItemId = -1;
	for (i = rsstlerUI.nextItemIndex; i < rsstlerUI.currentFeedItems.length && i < pageLimit; i++) {
	    var itm = rsstlerUI.renderFeedItem(rsstlerUI.currentFeedItems[i]);
	    feedDisplay.appendChild(itm);
	    rsstlerUI._items.push(itm);
	    if (firstItem == null) {
		firstItem = itm;
		firstItemId = i;
	    }
	}
	rsstlerUI.nextItemIndex = pageLimit;

	//
	//  Next page or end of feed
	//
	if (rsstlerUI.nextItemIndex >= rsstlerUI.currentFeedItems.length) {
	    rsstlerUI.addAllDone(feedDisplay,rsstlerUI.bmsvc.getItemTitle(rsstlerUI.currentFeedId));
	} else {
	    rsstlerUI.addNextPage(feedDisplay);
	};
	//
	//  If we're paging, we want to scroll to the top element
	//
	if (!endless) {
	    rsstlerUI.monitorScrollPrevent = true;
	    firstItem.scrollIntoView(true);
	    // RsstlerLogger.info("We are scrolling to item = "+firstItemId+" title = "+rsstlerUI.currentFeedItems[firstItemId].getTitle());
	};
	//
	//  Set up and focus
	//
	document.getElementById('feedDisplay').focus();
    },

    //
    //  Hard to pass back an array through XPIDL
    //
    getFeedItems: function (feed) {
	if (feed == null) return new Array();
	var showUnreadOnly = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_SHOW_UNREAD);
	var feedItems = new Array();
	//  Temporary attempt at fix!
	feed.readOldPosts(feed.getLastReadDate());
	for(var i=0;i<feed.getItemCount();i++) 
	    if (showUnreadOnly) {
		if (!feed.getItem(i).getRead()) 
		    feedItems.push(feed.getItem(i));
	    } else {
		feedItems.push(feed.getItem(i));
	    }

	return feedItems;
    },

    //
    //  Adds a notice at the end of the display.
    //
    addAllDone: function (feedDisplay, title) {
	var item = RsstlerUtils.makeElement("div","item","itemTerminator");
	var emptyItemText = '"'+ title + '" has no more items.';
	var notice = RsstlerUtils.makeElement("div","itemEmptyNotice");
	notice.appendChild(document.createTextNode(emptyItemText));
	item.appendChild(notice);
	feedDisplay.appendChild(item);
	// Add an empty div at the end that we can style to take up space
	var br = RsstlerUtils.makeElement("div","item","fillerSpace");
	feedDisplay.appendChild(br);
    },

    //
    //  Adds a link to load more items
    //
    addNextPage: function (feedDisplay) {
	var item = RsstlerUtils.makeElement("div","item","itemTerminator");
	// item.setAttribute("onclick","rsstlerUI.displayNextPage();");
	item.addEventListener("click", rsstlerUI.displayNextPage, false);			
	var notice = RsstlerUtils.makeElement("div","itemEmptyNotice");
	// notice.innerHTML = "Click for more results.";
	notice.textContent = "Click for more results.";
	item.appendChild(notice);
	feedDisplay.appendChild(item);
	// Add an empty div at the end that we can style to take up space
	var br = RsstlerUtils.makeElement("div","item","fillerSpace");
	feedDisplay.appendChild(br);
    },
    
    //
    //  A bit of a specialty function that deletes everything on a DOM element that
    //  have a "persist" attribute.  This is used to wipe out the contents of the feedDisplay
    //  and the treeView while leaving the permanent elements.
    //
    clearElement: function(element) {
	//
	//  We're going to render into feedDisplay so we need to get that and clear it.  Don't
	//  remove <input> elements -- those are off-screen checkboxes we use to apply CSS 
	//  styling to the feed items.
	//
	var children = element.childNodes;
	//  Go through the array backwards so that deleting nodes doesn't break the loop
	if (children.length > 0)
	    for (var i = children.length-1; i >= 0; i--) {
		if (children[i].nodeType == Node.ELEMENT_NODE && 
		    !children[i].getAttribute("persist")) element.removeChild(children[i]);
	    }

    },
    
    //
    //  Display a feed (or a folder!) in the feed items pane.
    //
    display: function(itemId) {
	if (itemId == null) return;
	var itemType = this.bmsvc.getItemType(itemId);
	if (itemType != rsstlerUI.bmsvc.TYPE_BOOKMARK && itemType != itemType == this.bmsvc.TYPE_FOLDER) return;
	rsstlerUI.notifyObservers("rsstlerWorking");
	var feedDisplay = document.getElementById("feedDisplay");
	var feed = null;
	var feedURI = "";
	var feedLink = null;
	var feedDesc = "";
	var feedTitle = "";
	var feedItems = null;
	
	if (itemType == this.bmsvc.TYPE_FOLDER) {
	    //
	    //  We need to find the bookmark node for this folder 
	    //
	    var folderRoot = RsstlerUtils.getNodeFromItemId(itemId);
	    if (folderRoot == null) return;
	    //
	    //  Set the document title to the folder name.
	    //
	    feedTitle = rsstlerUI.bmsvc.getItemTitle(itemId);
	    feedItems = rsstlerUI.getAllFeedItems(folderRoot);
	} else {
	    feed = RsstlerFeeds.getFeedById(itemId);
	    feedURI = feed.getFeedURI();
	    feedLink = feed.getLink();
	    feedTitle = feed.getTitle();
	    if (feed.hasDescription()) feedDesc = rsstlerUI.htmlToText(feed.getDescription());
	    feedItems = rsstlerUI.getFeedItems(feed);
	};

	//
	//  Clear the feed display
	//
	rsstlerUI.clearElement(feedDisplay);
	//
	//  Sets the title indicate which feed we've got displayed.
	//
	document.title = 'Rsstler: ' + feedTitle;
	//
	//  Making the header for the entire feed.
	//
	//  5/16/13 -- Duplicate into the feedDisplayHeader div so that we can make it fixed at the top of the window.
	//
	var feedDisplayHeader = document.getElementById("feedDisplayHeader");
	//  Delete any children out of here
	while (feedDisplayHeader.firstChild) feedDisplayHeader.removeChild(feedDisplayHeader.firstChild);
	var feedHeader = RsstlerUtils.makeElement("div","feedHeader","feedHeader");
	var feedTitleS = RsstlerUtils.makeElement("span","feedTitle","feedTitle");
	if (feedLink != null ) {
	    var feedLinkA = RsstlerUtils.makeElement("a","feedLink","feedLink");
	    rsstlerUI.setURIAttributeSafe(feedURI, feedLinkA, "href", feedLink);
	    if (RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_USE_NEW_WINDOWS)) {
		feedLinkA.target = "_blank";
	    };
	    feedLinkA.appendChild(document.createTextNode(feedTitle));
	    feedTitleS.appendChild(feedLinkA);
	} else {
	    feedTitleS.appendChild(document.createTextNode(feedTitle));
	}
	feedHeader.appendChild(feedTitleS);
	try {
	    feedDisplayHeader.appendChild(feedTitleS.cloneNode(true));
	} catch (e) {
	    RsstlerLogger.info("Cannot clone: "+e);
	}
	//
	//  Add the feed has a description, add that to the header
	//
	var br = RsstlerUtils.makeElement("br");
	feedHeader.appendChild(br);
	try {
	    feedDisplayHeader.appendChild(br.cloneNode(true));
	} catch (e) {
	    RsstlerLogger.info("Cannot clone: "+e);
	};
	var p = RsstlerUtils.makeElement("span","feedDesc","feedDesc");
	//  For the description, we always remove any HTML
	p.textContent = feedDesc;
	feedHeader.appendChild(p);
	feedDisplay.appendChild(feedHeader);
	try {
	    feedDisplayHeader.appendChild(p.cloneNode(true));
	} catch (e) {
	    RsstlerLogger.info("Cannot clone: "+e);
	};
	//
	//  Save current state
	//
	rsstlerUI._items = new Array();
	rsstlerUI.currentFeed = feed;
	rsstlerUI.currentFeedId = itemId;
	rsstlerUI.currentFeedItems = feedItems;
	rsstlerUI.nextItemIndex = 0;
	//
	//  Sort the feedItems according to the two preferences.
	//
	rsstlerUI.newestFirst = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_FEED_ITEM_ORDER) == "newestFirst";
	rsstlerUI.groupByFeed = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_GROUP_BY_FEED);
	rsstlerUI.currentFeedItems.sort(rsstlerUI.feedItemComparator);
	//
	//  We need to stick in the itemTerminator in case the feed is empty.
	//
	rsstlerUI.addAllDone(feedDisplay,feedTitle);
	//
	//  Display the next (first) page
	//
	rsstlerUI.displayNextPage();
	//
	//  Scroll to the top
	//
	rsstlerUI.monitorScrollPrevent = true;
	feedDisplay.scrollTop = 0;

	rsstlerUI.notifyObservers("rsstlerDone");
	
    },

    //
    //  This code takes a bookmark node for a folder and recursively gathers all 
    //  feed items contained therein. a.concat(b)
    //
    getAllFeedItems: function(aNode) {
	var itemId = aNode.itemId;
	var itemType = this.bmsvc.getItemType(itemId);
	if (itemType == this.bmsvc.TYPE_BOOKMARK) {
	    //
	    //  Get the feed corresponding to this bookmark and append all
	    //  its feed items onto the array.
	    //
	    var feed = RsstlerFeeds.getFeedById(itemId);
	    return rsstlerUI.getFeedItems(feed);
	} else if (itemType == this.bmsvc.TYPE_FOLDER) {
	    //
	    //  Go through all its children gathering feed items
	    //
	    aNode.QueryInterface(Components.interfaces.nsINavHistoryContainerResultNode);
	    aNode.containerOpen = true;
	    var feedItems = new Array();
	    for (var i = 0; i < aNode.childCount; i ++) {
		var childFeedItems = rsstlerUI.getAllFeedItems(aNode.getChild(i));
		feedItems.push.apply(feedItems, childFeedItems);
	    }
	    aNode.containerOpen = false;
	    return feedItems;
	}
	//
	//  Shouldn't get here, but if we do (separator?) no feed items
	//
	return new Array();
    },

    setURIAttributeSafe: function(fURI, element, attribute, uri) {
	var secman = Cc["@mozilla.org/scriptsecuritymanager;1"].getService(Ci.nsIScriptSecurityManager);
	var ios = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
	var feedURI = null, attrURI = null;

	const flags = Ci.nsIScriptSecurityManager.DISALLOW_INHERIT_PRINCIPAL;

	try {
	    feedURI = ios.newURI(fURI, null, null);
	    attrURI = ios.newURI(uri, null, null);
	    secman.checkLoadURIWithPrincipal((secman.getSimpleCodebasePrincipal)(feedURI), attrURI, flags);
	    element.setAttribute(attribute, attrURI.spec);
	} catch (e) { 
	    RsstlerLogger.info("Exception in setURISafe: "+e+"fURI = "+fURI+" uri = "+uri);
	};
    },

    //
    //  Read Marking
    //
    //  When an item is visible on the feed summary pane for a few seconds, it should
    //  be marked "read".  Unfortunately, there's no event for when an element comes 
    //  into view on a web page.  To do this, we have to monitor the scroll event and when a 
    //  new item comes into view, mark it as read.  Google Reader seems to mark items as
    //  read as soon as they scroll into view, so we'll take that approach as well.
    //
    //  5/9
    //
    //  Simplified but faster in-view testing.  (What we have is wrong anyway!)
    
    monitorScrollPrevent: false,  /* Flag to prevent treating our intentional scrolling as user scrolling. */

    monitorScroll: function (e) {
	// Do nothing if we're causing the scrolling 
	if (rsstlerUI.monitorScrollPrevent) {
	    rsstlerUI.monitorScrollPrevent = false;
	    return;
	}
	// If the user has this turned off, do nothing.
	if (!RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_AUTO_READ)) return;
	
	var items = rsstlerUI._items;
	var feedDisplay = document.getElementById("feedDisplay");
	var top = feedDisplay.scrollTop;
	var bottom = top + feedDisplay.offsetHeight;
	//
	//   Find items that are visible && unread and mark them
	//
	//   Only do the first couple so that we don't have a big pause...
	//
	var i, limit = 9999999;
	for(i=0; i<items.length && i < limit; i++) {
	    var itemTop = items[i].offsetTop;
	    // Early quit if we're below the window
	    if (itemTop > bottom) break;
	    var topIn = (itemTop >= top && itemTop <= bottom);
	    if (topIn && (!items[i].feedItem.getRead() || !items[i].getAttribute("readitem"))) {
		rsstlerUI.markAsRead(items[i]);
	    };
	    if (topIn && limit == 9999999) limit = i + 2;
	}
	// If we're endless and there's less than N items left, load more.
	var endless = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_USE_ENDLESS_DISPLAY);
	if (endless && (items.length-i)<5) {
	    rsstlerUI.displayNextPage();
	};

    },

    markAsRead: function (item) {
	//
	//  Mark the actual feedItem read
	//
	item.feedItem.setRead();
	//
	//  And add the readItem attribute to the display
	//
	item.setAttribute("readItem","true");
	//
	//  Update the unread count
	//
	// RsstlerLogger.info("updateTreeDom from markAsRead");
	TreeView.updateTreeDOM(item.feedItem.getFeed().getItemId());
    },

    markAsUnread: function (item) {
	//
	//  Mark the actual feedItem read
	//
	item.feedItem.setUnread();
	//
	//  Update the unread count
	//
	RsstlerLogger.info("updateTreeDom from markAsUnRead");
	TreeView.updateTreeDOM(item.feedItem.getFeed().getItemId());
    },

    //
    //  Functions for handling keyboard commands in the feed summary pane.
    //
    handleKeyPress : function(e) {
	var evtobj = window.event ? event : e;
	var code = evtobj.charCode? evtobj.charCode : evtobj.keyCode;
	var asciistr = String.fromCharCode(code);
	// RsstlerLogger.info("In handleKeyPress.");
	if (asciistr == RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_FS_NAVNEXT)) rsstlerUI.navNextItem();
	if (asciistr == RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_FS_NAVPREV)) rsstlerUI.navPrevItem();
	if (asciistr == RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_FS_NAV_NEXT_PAGE)) rsstlerUI.displayNextPage();
	if (asciistr == RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_FS_NAVMARK)) rsstlerUI.navMarkItem(evtobj);
	if (asciistr == RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_FS_NAVUNMARK)) rsstlerUI.navUnmarkItem(evtobj);
	if (asciistr == RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_FS_OPENITEM)) rsstlerUI.navOpenItem(evtobj);
    },

    //
    //  Is an element being displayed?
    elementDisplayed: function(el) {
	return (el.offsetHeight != 0);
    },

    //
    //  This checks to see whether any part of an element is visible within another element
    //
    elementVisibleInElement: function(el, view) {
	var elrect = el.getBoundingClientRect();
	var vwrect = view.getBoundingClientRect();

	return ( elrect.top <= vwrect.bottom &&
		 elrect.left <= vwrect.right &&
		 elrect.bottom >= vwrect.top &&
		 elrect.right >= vwrect.left );
    },

    //
    //  This checks to see whether the top of an element is visible
    //
    elementTopVisibleInElement: function(el, view) {
	var elrect = el.getBoundingClientRect();
	var vwrect = view.getBoundingClientRect();

	return (elrect.top >= vwrect.top && elrect.top <= vwrect.bottom);
    },

    //
    //  Mark finds the first visible element and marks it as read and "marked" so that
    //  it can be hidden away.
    //
    navMarkItem: function(evtobj) {
	var i;
	var items = rsstlerUI._items;
	var feedDisplay = document.getElementById("feedDisplay");
	//  Look for the first unmarked element with a visible top
	for(i=0; i<items.length &
	    (!rsstlerUI.elementDisplayed(items[i]) || 
	     !rsstlerUI.elementTopVisibleInElement(items[i],feedDisplay));i++);
	//  If that didn't work, look for the first visible unread
	if (i == items.length) {
	    for(i=0; i<items.length && 
		(!rsstlerUI.elementDisplayed(items[i]) || 
		 !rsstlerUI.elementVisibleInElement(items[i],feedDisplay));i++);
	};
	//  If that didn't work, we've got nothing to work on
	if (i == items.length) {
	    feedDisplay.focus();
	    return;
	}
	//  Now we want to mark that element as read.  Conveniently, markAsRead takes an items[]
	rsstlerUI.markAsRead(items[i]);
	//
	//  Add the attribute
	//
	items[i].setAttribute("readItem","true");
	items[i].setAttribute("markedItem","true");
	feedDisplay.focus();
    },

    navUnmarkItem: function(evtobj) {
	var i;
	var items = rsstlerUI._items;
	var feedDisplay = document.getElementById("feedDisplay");
	//  Look for the first read element with a visible top
	for(i=0; i<items.length && 
	    (!items[i].feedItem.getRead() || 
	     !rsstlerUI.elementTopVisibleInElement(items[i],feedDisplay));i++);
	//  If that didn't work, look for the first visible read
	if (i == items.length) {
	    for(i=0; i<items.length && 
		(!items[i].feedItem.getRead() || 
		 !rsstlerUI.elementVisibleInElement(items[i],feedDisplay));i++);
	};
	//  If that didn't work, we've got nothing to work on
	if (i == items.length) {
	    if (RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_NAV_NEXT_FEED)) {
		// Move on to the next feed...
		var nextFeedId = RsstlerFeeds.getNextFeed(rsstlerUI.currentFeedId);
		if (nextFeedId) rsstlerUI.display(nextFeedId);
	    };
	    feedDisplay.focus();
	    return;
	}
	//  Now we want to mark that element as read.  Conveniently, markAsRead takes an item[]
	// RsstlerLogger.info("Unmarking "+i+" as read.  getRead() = "+items[i].feedItem.getRead());
	rsstlerUI.markAsUnread(items[i]);
	//
	//  Remove the attribute
	//
	items[i].removeAttribute("readItem");
	items[i].removeAttribute("markedItem");
	feedDisplay.focus();
    },

    //
    //  Find the first visible item, and then scroll the next one to the top.
    //
    navNextItem: function () {
	var i,j;
	var items = rsstlerUI._items;
	var feedDisplay = document.getElementById("feedDisplay");

	if (typeof items == 'undefined') return;
	// Find the first item that is visible on the screen.
	for(i=0; i<items.length && !rsstlerUI.elementVisibleInElement(items[i],feedDisplay);i++);
	// No elements are visible on the screen.  This means we're at the end where the "Next Page"
	// notice is -- so hitting J in this situation means to trigger the next page.
	if (i >= items.length) {
	    if (rsstlerUI.nextItemIndex < rsstlerUI.currentFeedItems.length) { 
		rsstlerUI.displayNextPage();
	    } else {
		if (RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_NAV_NEXT_FEED)) {
		    // Move on to the next feed...
		    var nextFeedId = RsstlerFeeds.getNextFeed(rsstlerUI.currentFeedId);
		    if (nextFeedId) rsstlerUI.display(nextFeedId);
		};
	    }
	    return;
	}
	// Otherwise try to move forward to the next displayed element
	for(i=i+1;i<items.length && !rsstlerUI.elementDisplayed(items[i]);i++);
	//  If we're jumping to the second item, mark the first one read.  Otherwise
	//  there might never be a scroll event for the first item.
	if (i==1 && RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_AUTO_READ)) rsstlerUI.markAsRead(items[0]);
	//
	// If there's still a visible item left, scroll to it.
	//
	if (i < items.length) {
	    items[i].scrollIntoView(true);
	    rsstlerUI.markAsRead(items[i]);
	} else {
	    //  Try to scroll to the bumper at the end of the items
	    var term = document.getElementById("itemTerminator");
	    term.scrollIntoView(true);
	};
    },

    //
    //  Scroll to make the previous item visible.  
    //
    navPrevItem: function () {
	var i, j;
	var items = rsstlerUI._items;
	var feedDisplay = document.getElementById("feedDisplay");

	// Find the first item that is visible on the screen.
	for(i=0; i<items.length && !rsstlerUI.elementVisibleInElement(items[i],feedDisplay);i++);
	// Already at the last item or no item visible
	if (i == 0) return;
	// Otherwise see if we can find the previous visible (!) item to scroll to...
	for(j=i-1;j>=0 && !rsstlerUI.elementDisplayed(items[j]);j--);
	if (j < 0) return;
	//  J is it
	// RsstlerLogger.info(" offsetTop = "+items[j].offsetTop+" feedDisplay.offsetTop = "+feedDisplay.offsetTop);
	items[j].scrollIntoView(true);
    },

    navOpenItem: function () {
	var i, j;
	var items = rsstlerUI._items;
	var feedDisplay = document.getElementById("feedDisplay");

	// Find the first item that is visible on the screen.
	for(i=0; i<items.length && !rsstlerUI.elementVisibleInElement(items[i],feedDisplay);i++);
	// Already at the last item or no item visible
	if (i >= items.length) return;

	// Open the URL for this item in a tab
	var link = items[i].feedItem.getLink();
	var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
	var mainWindow = wm.getMostRecentWindow("navigator:browser");
	// Add tab, then make active
	mainWindow.gBrowser.addTab(link);
	// openUILinkIn(link,"tabshifted", false, null, null);
	rsstlerUI.navNextItem();
    },

    applySettings: function() {
	var chkHideReadFeeds = document.getElementById("chkHideReadFeeds");
	chkHideReadFeeds.checked = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_HIDE_READ_FEEDS);
	var chkHideEmptyFeeds = document.getElementById("chkHideEmptyFeeds");
	chkHideEmptyFeeds.checked = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_HIDE_EMPTY_FEEDS);
	//
	//   Set feedDisplay checkboxes to correspond to the preferences
	//
	var chkShowListOnly = document.getElementById("chkShowListOnly");
	chkShowListOnly.checked = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_SHOW_LIST);
	//
	//   Whether the title in feedDisplay floats
	//
	var useFixedDisplayHeader = document.getElementById("useFixedDisplayHeader");
	useFixedDisplayHeader.checked = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_USE_FIXED_DISPLAY_HEADER);
	//
	//   Whether to show the update status at the top of the feeds tree
	//
	var showUpdateStatus = document.getElementById("showUpdateStatus");
	showUpdateStatus.checked = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_SHOW_UPDATE_STATUS);
    },

    openSubscribeFeedDialog : function() {
	openDialog("chrome://rsstler/content/rsstlerSubscribe.xul", "rsstlerSubscribe", "chrome,centerscreen,modal,close");
	// Redraw the tree, in case we got a new feed.
	rsstlerUI.drawFeedsTree();
    },

    openSettingsDialog : function() {
	openDialog("chrome://rsstler/content/settings/settings.xul", "", "chrome,centerscreen,modal,close", this);
	// This should look for and apply any changed settings
	rsstlerUI.applySettings();
    },
    
    openHelp: function() {
	var wm = Cc["@mozilla.org/appshell/window-mediator;1"].getService(Ci.nsIWindowMediator);
	var mainWindow = wm.getMostRecentWindow("navigator:browser");
	// Add tab, then make active
	mainWindow.gBrowser.selectedTab = mainWindow.gBrowser.addTab("chrome://rsstler/locale/usersGuide.html");
    },

    //
    //  This is the "fix-it-all" button that tries to restart/redisplay everything.
    //
    refreshAll: function () {
	RsstlerFeeds.initFeeds();
	RsstlerFeeds.reStartCheck();
	rsstlerUI.display(rsstlerUI.currentFeedId);
    },
    
    //
    //  Setting a new root folder.  We have to clear out the feeds and redo everything...
    //
    setNewRootFolder: function(id) {
	RsstlerUtils.setRsstlerRootFolderId(id);
	RsstlerFeeds.resetFeeds();
	rsstlerUI.drawFeedsTree();
	rsstlerUI.currentFeedId = null;
    },

    //
    //  "Mark all as read" button.  Go through and mark everything displayed as read and then reload the feed.
    //
    markAllAsRead: function() {
	//
	//  All the displayed items are in rsstlerUI.currentFeedItems
	//
	if (!Array.isArray(rsstlerUI.currentFeedItems)) return;

	rsstlerUI.notifyObservers("rsstlerWorking");
	
	for(var i=0;i < rsstlerUI.currentFeedItems.length; i++)
	    rsstlerUI.currentFeedItems[i].setRead();
	//
	//  Now redisplay the tree and the feed.
	//
	//  FIXME
	//  At the moment if it's a folder we just redraw the whole thing
	//
	if (rsstlerUI.currentFeed == null) {
	    rsstlerUI.drawFeedsTree();
	} else {
	    RsstlerLogger.info("updateTreeDom from markAllAsRead");
	    TreeView.updateTreeDOM(rsstlerUI.currentFeedId);
	}
	rsstlerUI.display(rsstlerUI.currentFeedId);
	
	rsstlerUI.notifyObservers("rsstlerDone");
    },

    //
    //  Toggling folders open or closed in the treeview
    //
    //  Check to see if a folder is "open" by looking at its keyword and making sure it 
    //  isn't "closed"
    //
    //  Tue Aug 11 21:32:52 2015 -- Scott R. Turner
    //
    //  The set Keyword  ForBookmark() functionality has been removed in
    //  Gecko 40, so we have to find somewhere else to save the
    //  open/closed status of the folder.  Three choices are on the
    //  folder title, in the last mod date, or in the local DB.
    //  Saving it on the folder title means it will synchronize across
    //  machines (and might be a little easier).  However, it means
    //  the oddball character will show up in the Firefox Bookmarks if
    //  the user looks at them and/or organizes.  If we save it in the
    //  title, we'll need to fix makeFolderHTMLStart() in treeview.js
    //  to edit out whatever character we use to indicate open/closed.
    //  Note we also have to fix isFolderOpen() in treeview.js either
    //  way.
    //
    toggleFolder: function(itemId) {
	RsstlerLogger.info("In toggleFolder itemId: "+itemId);
	//	var kw = rsstlerUI.bmsvc.getKeyword   ForBookmark(itemId);
	var title = rsstlerUI.bmsvc.getItemTitle(itemId);
	var kw = title.indexOf("*");
	RsstlerLogger.info("In toggleFolder title: "+kw);
	//
	//  Open if it doesn't have the *
	//
	if (kw == -1) {
	    rsstlerUI.bmsvc.setItemTitle(itemId,title+"*");
	    // rsstlerUI.bmsvc.setKeyword   ForBookmark(itemId,"");
	} else {
	    rsstlerUI.bmsvc.setItemTitle(itemId,title.substring(0, title.length-1));
	    // rsstlerUI.bmsvc.setKeyword   ForBookmark(itemId,"closed");
	};
	//
	//  Re-draw the treeview of feeds
	//
	rsstlerUI.drawFeedsTree();
    },

    updateFullOrTitles: function () {
	var showListOnly = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_SHOW_LIST);
	// Update the UI
	var button = document.getElementById("fullOrTitles");
	var img = document.getElementById("imgFullOrTitles");
	if (showListOnly) {
	    button.setAttribute("state","titles");
	    img.setAttribute("state","titles");
	} else {
	    button.setAttribute("state","full");
	    img.setAttribute("state","full");
	};
    },

    //
    //   Toggle button support for showing full items or just their titles.  When we toggle this,
    //   we need to toggle the global flag and then reload the feed.
    //
    toggleFullOrTitles: function() {
	// Toggle the preference
	var showListOnly = !RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_SHOW_LIST);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_SHOW_LIST,showListOnly);
	// Update the UI
	rsstlerUI.updateFullOrTitles();
	// Apply the new setting
	rsstlerUI.applySettings();

    },

    updateAllOrUnread: function () {
	var showUnreadOnly = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_SHOW_UNREAD);
	// Update the UI
	var button = document.getElementById("allOrUnread");
	if (showUnreadOnly) {
	    // button.innerHTML = RsstlerUtils.getRsstlerStr("showingUnread");
	    button.textContent = RsstlerUtils.getRsstlerStr("showingUnread");
	} else {
	    // button.innerHTML = RsstlerUtils.getRsstlerStr("showingAll");
	    button.textContent = RsstlerUtils.getRsstlerStr("showingAll");
	};
    },


    toggleAllOrUnread: function() {
	// Toggle the preference
	var showUnreadOnly = !RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_SHOW_UNREAD);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_SHOW_UNREAD,showUnreadOnly);
	// Update the UI
	rsstlerUI.updateAllOrUnread();
	rsstlerUI.applySettings();
	//
	//  Now redisplay the tree and the feed.
	//
	// rsstlerUI.drawFeedsTree();
	rsstlerUI.display(rsstlerUI.currentFeedId);
    },

    //
    //  Remove all the "broken" feeds.
    //
    removeBrokenFeeds: function() {
	var batchFn = { runBatched: function (aUserData) {
	    RsstlerFeeds.removeBrokenFeeds();
	}
		      };
	bmsvc.runInBatchMode(batchFn, null); 
    },

    //
    //  Only necessary to support <iframe> solution
    //
    resizeMessage: function(event) {
	// Get the iframe id and the height from the message
	// RsstlerLogger.info("Received resize message: "+event.data);
	var iframeId = event.data.replace(/([^:]*):.*/,"$1");
	var iframeHeight = parseInt(event.data.replace(/.*:(\d*)/,"$1"));
	var iframe = document.getElementById(iframeId);
	iframe.style.height = iframeHeight + "px";
    }

};



window.addEventListener("load", rsstlerUI.init, false);
window.addEventListener("unload", rsstlerUI.uninit, false);

//Only necessary for <iframe> solution

window.addEventListener('message', rsstlerUI.resizeMessage, false); 

