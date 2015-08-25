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

var rsstlerOverlay = {

		hist: Components.classes["@mozilla.org/browser/nav-history-service;1"].getService(Components.interfaces.nsINavHistoryService),
		bmsvc: Components.classes["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Components.interfaces.nsINavBookmarksService),
		needsRestart : null,
  
		//
		//  Create a new folder for the Rsstler bookmarks called "Rsstler Feeds".  Sticks in a couple of sample feeds.
		//
		createFeedsFolder : function() {
			//
			//  Avoid making a new folder if one already exists.
			//
			var rootFolderId = RsstlerUtils.getFolderId(RsstlerUtils.RSSTLER_ROOT_TITLE);

			if (rootFolderId != null) {
				RsstlerUtils.setRsstlerRootFolderId(rootFolderId);
			} else {
				var folderId = rsstlerOverlay.bmsvc.createFolder(rsstlerOverlay.bmsvc.bookmarksMenuFolder, 
						RsstlerUtils.RSSTLER_ROOT_TITLE, rsstlerOverlay.bmsvc.DEFAULT_INDEX);
				RsstlerUtils.setRsstlerRootFolderId(folderId);
				RsstlerUtils.addBookmarkToFolder("BBC News | News Front Page | World Edition", 
						"http://news.bbc.co.uk/rss/newsonline_world_edition/front_page/rss091.xml", folderId);
				RsstlerUtils.addBookmarkToFolder("Boing Boing", 
						"http://feeds.boingboing.net/boingboing/iBag", folderId);
				RsstlerUtils.addBookmarkToFolder("Uncertain Principles", 
						"http://scienceblogs.com/principles/feed/", folderId);
			}
		},

		/**
		 * https://developer.mozilla.org/en-US/docs/Code_snippets/Toolbar
		 * 
		 * Installs the toolbar button with the given ID into the given
		 * toolbar, if it is not already present in the document.
		 *
		 * @param {string} toolbarId The ID of the toolbar to install to.
		 * @param {string} id The ID of the button to install.
		 */
		installButton: function(toolbarId, id) {
			//
			//  Don't install if it already exists.
			//
			if (!document.getElementById(id)) {
				var toolbar = document.getElementById(toolbarId);

				toolbar.insertItem(id, null);
				toolbar.setAttribute("currentset", toolbar.currentSet);
				document.persist(toolbar.id, "currentset");

				if (toolbarId == "addon-bar") toolbar.collapsed = false;
			}
		},

		//
		//   Adding Rsstler as a "content handler" makes it appear in the list of choices for subscribing to
		//   a feed.  Note that we'll have to do something with the chrome://rsstler/content/rsstler.html?feed=%s URL. 
		//
		addContentHandler : function() {
			Components.classes["@mozilla.org/embeddor.implemented/web-content-handler-registrar;1"]
			.getService(Components.interfaces.nsIWebContentHandlerRegistrar)
			.registerContentHandler("application/vnd.mozilla.maybe.feed",
					"chrome://rsstler/content/rsstler.html?feed=%s",
					"Rsstler",
					null);
		},

		//
		//  New User functionality
		//
		checkNewUser : function() {
			var brandNew = false;
			var prefVersion = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_VERSION);

			if ( prefVersion == null || prefVersion == "") {
				brandNew = true;
			}
			if (prefVersion != RsstlerUtils.VERSION) {
				RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_VERSION, RsstlerUtils.VERSION);
			}

			if (brandNew) {
				//
				//  One-time extension setup
				//
				RsstlerLogger.info("One-time set up.");
				rsstlerOverlay.createFeedsFolder();
				RsstlerLogger.info("Adding button");
				//  How do we use the DTD definition here?
				rsstlerOverlay.installButton("addon-bar","rsstlerButton");
				// rsstlerOverlay.addContentHandler();
			}

			return true;
		},

		init : function() {
			// var Logger = new Components.Constructor("@rsstler.mozdev.org/rsstler/logger;1", "rsstlerILogger", "init");
			rsstlerOverlay.logger = new rsstlerLogger();
			rsstlerOverlay.checkNewUser();
			RsstlerFeeds.init(RsstlerUtils.getRsstlerRootFolderId());
			RsstlerLogger.info("initialized");
		},

		//
		//   The uninit on RsstlerFeeds will save all the unread items locally.
		//
		uninit : function(e) {
			RsstlerLogger.info("Uninit!");
			RsstlerFeeds.uninit();
		},

		openRsstler: function(event) {
			// gBrowser.selectedTab = gBrowser.addTab("chrome://rsstler/content/rsstler.html");
			// openUILinkIn("chrome://rsstler/content/rsstler.html","current", false, null, null);
			if (!rsstlerOverlay.reuseTab("chrome://rsstler/content/rsstler.html")) {
				openUILink("chrome://rsstler/content/rsstler.html", event, false, true);
			};
		},
		
		openRsstlerInTab: function(event) {
			if (!rsstlerOverlay.reuseTab("chrome://rsstler/content/rsstler.html")) {
				openUILinkIn("chrome://rsstler/content/rsstler.html","tab", false, null, null);
			};
		},
		
		reuseTab: function(url) {
			var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
			.getService(Components.interfaces.nsIWindowMediator);
			var browserEnumerator = wm.getEnumerator("navigator:browser");

			// Check each browser instance for our URL
			var found = false;
			while (!found && browserEnumerator.hasMoreElements()) {
				var browserWin = browserEnumerator.getNext();
				var tabbrowser = browserWin.gBrowser;

				// Check each tab of this browser instance
				var numTabs = tabbrowser.browsers.length;
				for (var index = 0; index < numTabs; index++) {
					var currentBrowser = tabbrowser.getBrowserAtIndex(index);
					if (url == currentBrowser.currentURI.spec) {

						// The URL is already opened. Select this tab.
						tabbrowser.selectedTab = tabbrowser.tabContainer.childNodes[index];

						// Focus *this* browser-window
						browserWin.focus();

						found = true;
						break;
					}
				}
			}

			return found;
		},
			 
};

window.addEventListener("load", rsstlerOverlay.init, false);
window.addEventListener("beforeunload", rsstlerOverlay.uninit, false);
window.addEventListener("close", rsstlerOverlay.uninit, false);

