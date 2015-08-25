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
Components.utils.import("resource://gre/modules/PrivateBrowsingUtils.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://rsstler/rsstlerLogger.jsm");
Components.utils.import("resource://rsstler/rsstlerFeedParser.jsm");
// Components.utils.import("resource://services-sy  nc  /main.js");

//
//  RsstlerFeeds is a global singleton object that holds the state of all the feeds.
//
var EXPORTED_SYMBOLS = ["RsstlerFeeds", "rsstlerFeed", "rsstlerFeedItem", "rsstlerFeedItemEnclosure"];

var Cc = Components.classes;
var Ci = Components.interfaces;

var loader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
loader.loadSubScript("chrome://rsstler/content/rsstlerUtils.js");
loader.loadSubScript("chrome://rsstler/content/rsstlerFeed.js");
loader.loadSubScript("chrome://rsstler/content/rsstlerFeedItem.js");
loader.loadSubScript("chrome://rsstler/content/rsstlerFeedItemEnclosure.js");

var RsstlerFeeds = {

		feedList: new Array(),
		_initialized: false,
		DB_NAME: "rsstlerDB",           // The name of the database
		DB_VERSION: 2,				    // Version of the database (long long integer)
		DB_STORE_FI: "feedItems",          // The object store for feed items
		DB_STORE_LRDL: "lastReadDateLocal", // The object store for the feed's lastReadDateLocal 
		db: null,                       // Actual DB
		IDBKeyRange: null,              // Pointer to IDBKeyRange
		delay: 15000,
		feedParser: null,

		// hist: Cc["@mozilla.org/browser/nav-history-service;1"].getService(Ci.nsINavHistoryService),
		// anno: Cc["@mozilla.org/browser/annotation-service;1"].getService(Ci.nsIAnnotationService),

		bmsvc: Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Ci.nsINavBookmarksService),
		hist: Cc["@mozilla.org/browser/nav-history-service;1"].getService(Ci.nsINavHistoryService),

		// 
		//  When bookmarks are changed, we need to update both RsstlerFeeds (new feeds may have been added), and 
		//  redraw the feed tree on the UI to reflect the new bookmarks.  If we're in a batch update, we can
		//  hold the UI redraw until after the batch completes.
		//
		bookmarkListener: {
			suspendFlag: false,
			onBeginUpdateBatch: function() {
				// RsstlerLogger.info("In bookmark listener, on BeginUpdateBatch.");
				this.suspendFlag = true; 
			},
			onEndUpdateBatch: function() {
				// RsstlerLogger.info("In bookmark listener, in EndUpdateBatch");
				this.suspendFlag = false;
				// Tell UI that we've started checking
				// RsstlerFeeds.initFeeds();
				RsstlerFeeds.notifyObservers("rsstlerBookmarkChange");
			},
			onItemAdded: function(aItemId, aFolder, aIndex) {
				// RsstlerLogger.info("In bookmark listener 3.  suspend = "+this.suspendFlag);
				RsstlerFeeds.initFeeds();
				if (!this.suspendFlag) RsstlerFeeds.notifyObservers("rsstlerBookmarkChange");
			},
			onItemRemoved: function(aItemId, aFolder, aIndex) { 
				RsstlerLogger.info("In bookmark listener. 4");
				RsstlerFeeds.removeFeedById(aItemId);
				if (!this.suspendFlag) RsstlerFeeds.notifyObservers("rsstlerBookmarkChange");
			},
			onItemMoved: function(aItemId, aOldParent, aOldIndex, aNewParent, aNewIndex) { 
				// RsstlerLogger.info("In bookmark listener. 5");
				RsstlerFeeds.initFeeds();
				if (!this.suspendFlag) RsstlerFeeds.notifyObservers("rsstlerBookmarkChange");
			},
			onFolderAdded: function(folder,parent,index) { 
				// RsstlerLogger.info("In bookmark listener. 6");
				RsstlerFeeds.initFeeds();
				if (!this.suspendFlag) RsstlerFeeds.notifyObservers("rsstlerBookmarkChange");
			},
			onFolderRemoved: function(folder,parent,index) { 
				// RsstlerLogger.info("In bookmark listener. 7");
				RsstlerFeeds.initFeeds();
				if (!this.suspendFlag) RsstlerFeeds.notifyObservers("rsstlerBookmarkChange");
			},
			//
			//  In this case the only thing we really care about is if the URI changes.
			//
			//
			onItemChanged: function(aItemId, aProperty, aIsAnnotationProperty, aNewValue,
					aLastModified, aItemType, aParentId, aGUID, aParentGUID) {
				if (aProperty == "uri") {
					// RsstlerLogger.info("In bookmark listener. 8 uri = "+aNewValue);
					var feed = RsstlerFeeds.getFeedById(aItemId);
					feed.checkChangedURL();
					RsstlerFeeds.initFeeds();
					if (!this.suspendFlag) RsstlerFeeds.notifyObservers("rsstlerBookmarkChange");
				};
			},

			onFolderChanged: function() {
				// RsstlerLogger.info("In bookmark listener. 9 uri = "+uri);
				RsstlerFeeds.initFeeds();
				RsstlerFeeds.notifyObservers("rsstlerBookmarkChange");
			},
			onItemReplaced: function() {
				// RsstlerLogger.info("In bookmark listener. 10");
				RsstlerFeeds.initFeeds();
				if (!this.suspendFlag) RsstlerFeeds.notifyObservers("rsstlerBookmarkChange");
			},
			onItemVisited: function() {},
			onSeparatorAdded: function() {},
			onSeparatorRemoved: function() {},
			QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsINavBookmarkObserver])
		},

		//
		//  Initialization
		//
		init: function() {
			RsstlerLogger.init();

			RsstlerLogger.info("RsstlerFeeds init.");
			if (RsstlerFeeds._initialized) {
				RsstlerLogger.warn("Attempt to initialize RsstlerFeeds again.");
				return;
			}
			//
			//  For parsing the feeds
			//
			RsstlerFeeds.feedParser = new rsstlerFeedParser();
			//
			//  Initial delay
			//
			RsstlerFeeds.delay = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_CHECK_INTERVAL_INACTIVE); 
			//
			//  Add bookmarks observer
			//
			RsstlerFeeds.bmsvc.addObserver(RsstlerFeeds.bookmarkListener, false);
			//
			//  initDB is asynchronous and we want to wait for it to complete before we call 
			//  initFeeds and initUpdate, so we have to send initDB a function to execute when
			//  it's asynch completes.
			//
			RsstlerFeeds.initDB(function () {
				RsstlerFeeds.initFeeds();
				RsstlerFeeds.initUpdate();
				RsstlerFeeds._initialized = true;
			    //
			    //  Force bookmarks update
			    //
			    // Weave.Service.errorHandler.sy  nc  AndReportErrors();
				RsstlerLogger.info("RsstlerFeeds initialized."); });
		},

		dumpFeedsInfo: function () {
			for(var i=0;i<RsstlerFeeds.feedList.length;i++)
				RsstlerLogger.info("Feed '"+RsstlerFeeds.feedList[i].getTitle()+"' has "+
						RsstlerFeeds.feedList[i].getUnreadItemCount()+" unread items and "+
						RsstlerFeeds.feedList[i].getItemCount()+" total items.");
		},

		//
		//  The UI is open or closed
		//
		openUI: function() {
			RsstlerFeeds.delay = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_CHECK_INTERVAL_ACTIVE);
			RsstlerFeeds.resetTimer();
		},

		closeUI: function() {
			// RsstlerLogger.info("Closing UI.");
			RsstlerFeeds.delay = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_CHECK_INTERVAL_INACTIVE);
			RsstlerFeeds.resetTimer();
			// RsstlerLogger.info("Before dump.");
			RsstlerFeeds.dumpFeedsToDB();
		},

		//
		//  Take a bookmark node and add all the bookmarks therein to the feeds.  
		//
		//  If a feed already exists, we set the URI again.  This is because the bookmark might have
		//  changed due to a "synch", and the new bookmark might be annotated with a "lastRead" that 
		//  we need to capture.
		//
		addToFeeds: function (aResultNode) {
			var itemId = aResultNode.itemId;
			var itemType = null;
			try {
				itemType = RsstlerFeeds.bmsvc.getItemType(itemId);
			} catch (e) {
				RsstlerLogger.warn("Top-level Rsstler folder is invalid in addToFeeds.");
				return;
			};

			if (itemType == RsstlerFeeds.bmsvc.TYPE_BOOKMARK) {
				if (!RsstlerFeeds.getFeedById(itemId)) {
					var feed = RsstlerFeeds.createFeed(itemId,RsstlerFeeds.bmsvc.getBookmarkURI(itemId).spec);
					feed.setTitle(RsstlerFeeds.bmsvc.getItemTitle(itemId));
				} else {
					//  This will update the "lastRead" for the feed if it is newer on the bookmark
					// RsstlerFeeds.getFeedById(itemId).setFeedURI(RsstlerFeeds.bmsvc.getBookmarkURI(itemId).spec);
				}
			} else if (itemType == RsstlerFeeds.bmsvc.TYPE_FOLDER) {
				aResultNode.QueryInterface(Components.interfaces.nsINavHistoryContainerResultNode);
				aResultNode.containerOpen = true;
				for (var i = 0; i < aResultNode.childCount; i ++) {
					RsstlerFeeds.addToFeeds(aResultNode.getChild(i));
				}
				aResultNode.containerOpen = false;
			}
		},

		arrayRemove: function(array, from, to) {
			var rest = array.slice((to || from) + 1 || array.length);
			array.length = from < 0 ? array.length + from : from;
			return array.push.apply(array, rest);
		},

		removeFeedById: function (itemId) {
			//
			//  Find this feed's location in the feedList and remove it.
			//
			for(var i=0;i<RsstlerFeeds.feedList.length;i++)
				if (itemId === RsstlerFeeds.feedList[i].getItemId()) {
					RsstlerFeeds.arrayRemove(RsstlerFeeds.feedList,i);
					break;
				}
		},

		removeBookmark: function (feed) {
			//
			//  Remove the bookmark -- the listener should do the rest.
			//
			RsstlerFeeds.bmsvc.removeItem(feed.getItemId());
		},

		removeBrokenFeeds: function(feed) {
			var brokenFeeds = new Array();
			for(var i=0;i<RsstlerFeeds.feedList.length;i++)
				if (RsstlerFeeds.feedList[i].isBroken())
					brokenFeeds.push(RsstlerFeeds.feedList[i]);
			for(var i=0;i<brokenFeeds.length;i++) {
				// RsstlerFeeds.removeFeed(brokenFeeds[i]);
				RsstlerFeeds.removeBookmark(brokenFeeds[i]);
			}

		},

		//
		//  This looks to see if there is a Rsstler feeds folder; if so it adds all the
		//  feeds there.
		//
		initFeeds: function() {
			var rootId = RsstlerUtils.getRsstlerRootFolderId();
			if (rootId && rootId != null) {
				var root = RsstlerUtils.getNodeFromItemId(rootId);
				RsstlerFeeds.addToFeeds(root);
			};
		},

		// 
		//  Wipe out the old feedList and start over...
		//
		resetFeeds: function() {
			RsstlerFeeds.feedList = new Array();
			RsstlerFeeds.initFeeds();
			RsstlerFeeds.reStartCheck();
		},

		//
		//  This initializes the database, so that when we load feeds we can restore
		//  feedItems into the feeds.
		//
		initDB: function(callback) {
			if (RsstlerFeeds.db != null) return;

			var windowMediator = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
			var win = windowMediator.getMostRecentWindow(null);
			//
			//  Save a reference to IDBKeyRange so that feeds can later use it.
			//
			RsstlerFeeds.IDBKeyRange = win.IDBKeyRange;
			//  Second parameter here is the version number -- an integer.  Change it when the schema changes.
			var request = win.indexedDB.open(RsstlerFeeds.DB_NAME, RsstlerFeeds.DB_VERSION);
			request.onerror = function(event) {
				RsstlerLogger.warn("Error opening "+RsstlerFeeds.DB_NAME+" database: "+request.errorCode);
				callback();
			};
			//  Save the DB pointer
			request.onsuccess = function(event) {
				RsstlerFeeds.db = request.result;
				callback();
			};
			request.onupgradeneeded = function(event) {
				var db = event.target.result;
				//
				// Create an objectStore within the DB.  This raises an error if the object store 
				// already exists, so it seems you should first delete the object store.
				//
				try {
					db.deleteObjectStore(RsstlerFeeds.DB_STORE_FI);
				} catch (e) {
					RsstlerLogger.info("Exception deleting DB_STORE_FI: "+e);
				}; 
				var objectStore = db.createObjectStore(RsstlerFeeds.DB_STORE_FI, { autoIncrement: true });
				//
				// Create an index to itemFeeds by feedURI.  This will allows to narrow down to 
				// just the items belonging to a particular feed.
				// 
				objectStore.createIndex("feedURI", "feedURI", { unique: false });
				//
				//  Create the object store for lastReadDateLocal.  The key for this the URL of the 
				//  feed.
				//
				try {
					db.deleteObjectStore(RsstlerFeeds.DB_STORE_LRDL);
				} catch (e) {
					RsstlerLogger.info("Exception deleting DB_STORE_LRDL: "+e);
				}; 
				db.createObjectStore(RsstlerFeeds.DB_STORE_LRDL, { keyPath: "fURL" });
			};
		},

		uninit: function() {
			//
			//  Try to dump -- probably won't finish.
			//
			RsstlerFeeds.dumpFeedsToDB();
			//
			//  Remove bookmarks observer
			//
			RsstlerFeeds.bmsvc.removeObserver(RsstlerFeeds.bookmarkListener);
			//
			//  Terminate Http
			//
			if (RsstlerFeeds.checking) {
				if (RsstlerFeeds.headReq) RsstlerFeeds.headReq.abort();
				if (RsstlerFeeds.httpReq) RsstlerFeeds.httpReq.abort();
				RsstlerFeeds.checking = false;
			}
		},
		
		//
		//  This dumps the LRDL for one feed to the database.
		//
		dumpLRDLtoDB: function (feed) {
			//
			//  In private browsing mode, we don't save to the DB
			//
			var windowMediator = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
			var win = windowMediator.getMostRecentWindow(null);
			if (PrivateBrowsingUtils.isWindowPrivate(win)) return;
			
			try {
				var transaction = RsstlerFeeds.db.transaction([RsstlerFeeds.DB_STORE_LRDL], "readwrite");
				transaction.onerror = function (event) {
					RsstlerLogger.error("Transaction error writing DB_LRDL: "+event);
				};
				transaction.oncomplete = function (event) {
				};
				var objectStore = transaction.objectStore(RsstlerFeeds.DB_STORE_LRDL);
				// RsstlerLogger.info("Saving LRDL for "+feed.getTitle());
				feed.saveLRDL(objectStore);
			} catch (e) {
				RsstlerLogger.info("Exception trying to save lastReadDateLocal: "+e);
			};
		},

		//
		//  Clear the database and dump the unread items from all the feeds.  The error console is gone
		//  by the time this happens, so there's not much we can do if we have a problem.
		//
		//  5/14/13 -- Do all the database writes on a single transaction, so that we cannot end up 
		//  with a partially written db.
		//
		dumpFeedsToDB: function () {
			//
			//  In private browsing mode, we don't save to the DB
			//
			var windowMediator = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);
			var win = windowMediator.getMostRecentWindow(null);
			if (PrivateBrowsingUtils.isWindowPrivate(win)) return;
			

			var add_limit = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_FEED_ITEM_SAVE_LIMIT);
			var start = new Date();
			try {
				var transaction = RsstlerFeeds.db.transaction([RsstlerFeeds.DB_STORE_FI], "readwrite");
				transaction.onerror = function (event) {
					RsstlerLogger.error("Transaction error writing DB: "+event);
				};
				transaction.oncomplete = function (event) {
					RsstlerLogger.info("Database write complete in "+(((new Date()).getTime() - start.getTime()) / 1000)+" seconds.");
				};
				var objectStore = transaction.objectStore(RsstlerFeeds.DB_STORE_FI);
				var req = objectStore.clear();
				req.onerror = function (evt) {
					RsstlerLogger.error("Error clearing objectStore: "+evt);
				};
				req.onsuccess = function(evt) {
					//
					//  We've cleared the object store, so now walk through all the feeds and save
					//
					for(var i=0;i<RsstlerFeeds.feedList.length;i++) {
						RsstlerFeeds.feedList[i].saveDB(objectStore, add_limit);
					};
				};
			} catch (e) {
				//
				//  If there was an error clearing the object store, still try to dump.
				//
				for(var i=0;i<RsstlerFeeds.feedList.length;i++) {
					RsstlerFeeds.feedList[i].saveDB(objectStore, add_limit);
				};
			}
			// RsstlerLogger.info("Done dumping Rsstler database.");
		},

		//
		//  Create a feed.
		//
		createFeed: function(id, uri) {
			var feed = RsstlerFeeds.getFeedById(id);
			if (feed != null) return feed;

			feed = new rsstlerFeed(id, uri);
			//
			//  Load up any saved feed items
			//
			// RsstlerLogger.info("alwaysKeepSaved = "+RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_ALWAYS_KEEP_LOCAL));
			feed.loadFeedItemsFromDB(RsstlerFeeds.db, RsstlerFeeds.DB_STORE_FI, RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_ALWAYS_KEEP_LOCAL));
			feed.loadLRDLFromDB(RsstlerFeeds.db, RsstlerFeeds.DB_STORE_LRDL);
			RsstlerFeeds.feedList.push(feed);
			return feed;
		},

		//
		//  Get a feed by ItemId.  If one doesn't exist, null is returned.
		//
		getFeedById: function(id) {
			for(var i=0;i<RsstlerFeeds.feedList.length;i++) {
				if (id == RsstlerFeeds.feedList[i].getItemId()) 
					return RsstlerFeeds.feedList[i];
			};
			return null;
		},

		getFeedCount: function () {
			return RsstlerFeeds.feedList.length;
		},

		getFeedByIndex: function (index) {
			if (index < 0 || index >= RsstlerFeeds.feedList.length) return null;
			return RsstlerFeeds.feedList[index];  
		},
		
		getNextFeed: function(id) {
			var i, j;
			for(i=0;i<RsstlerFeeds.feedList.length;i++) {
				if (id == RsstlerFeeds.feedList[i].getItemId()) {
					break;
				};
			};
			// Now find the next feed
			for(j=i;j<RsstlerFeeds.feedList.length;j++) {
				if (RsstlerFeeds.feedList[j].hasUnreadItems()) 
					return RsstlerFeeds.feedList[j].getItemId();
			}
			
			return null; 
		},

		//
		//  From here down is functionality to update the feeds.  Original code from Sage.
		// 
		checking: false,
		checkList: null,
		httpReq: null,
		headReq: null,
		lastItemId: -1,
		lastFeed: null,
		_timer: null,
		_initialTimer: null,


		/********************************************************
		 * Initialization and timer functions
		 ********************************************************/

		initUpdate: function() {
			RsstlerFeeds.startTimer();
			RsstlerFeeds._initialized = true;
			// RsstlerLogger.info("RsstlerFeeds initUpdate.");
		},

		//
		//  Our delay is going to be between updates, so rather than use a TYPE_REPEATING_SLACK timer, 
		//  we'll use a single shot timer and set it off again when the check finishes.
		//
		startTimer: function() {
			var callback = {};
			callback.notify = function() {
				RsstlerFeeds.startCheck();
			};
			RsstlerFeeds._timer = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
			RsstlerFeeds._timer.initWithCallback(callback, RsstlerFeeds.delay, Ci.nsITimer.TYPE_ONE_SHOT);
		},

		resetTimer: function() {
			RsstlerFeeds._timer.cancel();
			RsstlerFeeds._timer = null;
			RsstlerFeeds.startTimer();
		},

		//
		//  Notify observers of an event
		//
		notifyObservers: function(aEvent, aValue) {
			var observerService = Cc["@mozilla.org/observer-service;1"]
			.getService(Ci.nsIObserverService);
			observerService.notifyObservers(null, aEvent, aValue);
		},

		/********************************************************
		 * Helpers
		 ********************************************************/

		getURL: function(aItemId) {
			return RsstlerFeeds.bmsvc.getBookmarkURI(aItemId).spec;
		},

		/********************************************************
		 * Network functions and actually checking
		 ********************************************************/
		//
		//  reStartCheck restarts the feed checking.
		//
		reStartCheck: function () {
			if (RsstlerFeeds.headReq) {
				RsstlerFeeds.headReq.abort();
				RsstlerFeeds.headReq = null;
			}
			if (RsstlerFeeds.httpReq) {
				RsstlerFeeds.httpReq.abort();
				RsstlerFeeds.httpReq = null;
			}
			RsstlerFeeds.checking = false;
			// RsstlerFeeds.startTimer();
			RsstlerFeeds.startCheck();
		},

		//
		//  startCheck goes through all the feeds in RsstlerFeeds and checks
		//  each in turn.
		//
		startCheck: function() {
			if (RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_STOP_CHECKING)) return;
			if (RsstlerFeeds.checking) return;
			RsstlerLogger.info("Starting feeds check.");

			//  
			//  Queue up all the feeds to be checked.  Note that what we queue is 
			//  now a rsstlerIFeed object.  It will have at least the itemId filled in.
			//
			var feedList = RsstlerFeeds.feedList;
			RsstlerFeeds.checkList = new Array();

			for(var i=0;i<feedList.length;i++) {
				RsstlerFeeds.checkList.push(feedList[i]);
			}

			RsstlerLogger.info("found " + RsstlerFeeds.checkList.length + " feed(s) to check");

			// Tell UI that we've started checking
			RsstlerFeeds.notifyObservers("rsstlerCheckStart");

			if (RsstlerFeeds.checkList.length > 0) {
				RsstlerFeeds.checking = true;
				RsstlerFeeds.check();
			}
		},

		lastHead: null,

		//
		//  To check a feed, we first do a HEAD request and see when the feed was last modified.
		//  If it has been modified since we last read it, then we go ahead and do a full GET 
		//  and parse of the feed.
		//
		check: function() {
			// 
			//  Some cleanup
			//
			RsstlerFeeds.headReq = null;
			RsstlerFeeds.httpReq = null;
			//
			//  We may be done at this point
			//
			if (RsstlerFeeds.checkList.length == 0) {
				RsstlerFeeds.checking = false;
				// Save the database
				RsstlerFeeds.dumpFeedsToDB();
				// Tell UI that we've just finished checking
				RsstlerFeeds.notifyObservers("rsstlerCheckDone");
				// And set up the next check
				RsstlerFeeds.startTimer();
				return;
			};
			//
			//  Pop the first rsstlerIFeed off of the checkList.  We save off the 
			//  feed for later.
			//
			var feed = RsstlerFeeds.checkList.shift();
			RsstlerFeeds.lastFeed = feed;
			RsstlerFeeds.lastItemId = feed.getItemId();
			var name = feed.getTitle();
			var url = feed.getFeedURI();

			//
			//  If there's no URL we can try to fetch it.
			//
			if(!url) {
				url = RsstlerFeeds.bmsvc.getBookmarkURI(feed.getItemId()).spec;
				if (!url) {
					RsstlerFeeds.check();
					return;
				}
				feed.setFeedURI(url);
			}

			//
			// Tell the UI what we're checking
			//
			RsstlerFeeds.notifyObservers("rsstlerCheckFeed",feed.getTitle());

			// RsstlerLogger.info("Pinging "+feed.getTitle());

			//
			//  Abort the last head request if it's still there for some reason.
			//
			if (RsstlerFeeds.headReq) {
				RsstlerFeeds.headReq.abort();
			}
			// 
			//  This is the HEAD request that will tell us whether we need to do a GET
			//
			RsstlerFeeds.headReq = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
			RsstlerFeeds.headReq.parent = this;
			RsstlerFeeds.headReq.open("HEAD", url);
			RsstlerFeeds.headReq.timeout = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_WAIT_FOR_RESPONSE);
			//
			//  The real work will happen in RsstlerFeeds.httpLoaded
			//
			RsstlerFeeds.headReq.addEventListener("load", RsstlerFeeds.headLoaded, false);
			RsstlerFeeds.headReq.addEventListener("error", RsstlerFeeds.headError, false);
			// RsstlerFeeds.headReq.addEventListener("abort", RsstlerFeeds.headAbort, false);
			RsstlerFeeds.headReq.addEventListener("timeout", RsstlerFeeds.headTimeout, false);

			try {
				RsstlerFeeds.headReq.setRequestHeader("User-Agent", RsstlerUtils.USER_AGENT);
				RsstlerFeeds.lastHead = RsstlerFeeds.lastFeed.getTitle();
				RsstlerFeeds.headReq.send();
			} catch(e) {
				// FAILURE
				RsstlerLogger.warn("Exception sending head request: "+e);
				RsstlerFeeds.headReq.abort();
				RsstlerFeeds.headReq = null;
			}

		},

		//
		//   Errors during the HEAD operation usually indicate a URL that is no longer reachable.
		//
		headError: function(e) {
			RsstlerLogger.warn("Error during HEAD request: "+e.target.channel.originalURI.spec+" status = "+e.target.status);
			RsstlerFeeds.headReq = null;
			//  Mark this feed as "broken"
			RsstlerFeeds.lastFeed.setBroken();
			//  Go on to the next feed.
			RsstlerFeeds.check();
		},

		//
		//   Timeout during the HEAD operation usually indicate a URL that is no longer reachable.
		//
		headTimeout: function(e) {
			// RsstlerLogger.warn("Timeout during HEAD request: "+e.target.channel.originalURI.spec+" status = "+e.target.status);
			RsstlerFeeds.headReq = null;
			//  Mark this feed as "broken"
			RsstlerFeeds.lastFeed.setBroken();
			//  Go on to the next feed.
			RsstlerFeeds.check();
		},

		headLoaded: function(e) {

			// RsstlerLogger.info("Ping answered for "+e.target.channel.originalURI.spec+" status = "+e.target.status);
			if (RsstlerFeeds.headReq.status < 200 || RsstlerFeeds.headReq.status > 299) {
				RsstlerFeeds.lastFeed.setBroken();
				RsstlerFeeds.headReq = null;
				RsstlerFeeds.check();
				return;
			}

			//  We reached the feed, so it isn't broken
			RsstlerFeeds.lastFeed.clearBroken();

			// Last-Modified: Tue, 15 Nov 1994 12:45:26 GMT
			var lastUpdateMsg = RsstlerFeeds.headReq.getResponseHeader("Last-Modified");
			var lastUpdate = null;

			if (lastUpdateMsg != null) {
				lastUpdate = new Date(lastUpdateMsg);
			};

			RsstlerFeeds.headReq = null;
			//
			//  If lastUpdate <= feed.lastUpdate, then we're done
			//
			if (lastUpdate != null && RsstlerFeeds.lastFeed.getLastUpdate() != null &&  
					lastUpdate.getTime() <= RsstlerFeeds.lastFeed.getLastUpdate()) {
				// RsstlerLogger.info("feed.getLast = "+RsstlerFeeds.lastFeed.getLastUpdate()+" lastUpdate = "+lastUpdate.getTime());
				// RsstlerLogger.info("Nothing new for "+RsstlerFeeds.lastHead);
				//  Go on to the next feed.
				RsstlerFeeds.check();
				return;
			};

			// RsstlerLogger.info();
			if (lastUpdate != null) {
				RsstlerFeeds.lastFeed.setLastUpdate(lastUpdate.getTime());
			}

			//
			//  Otherwise kick off the GET
			//
			var url = RsstlerFeeds.lastFeed.getFeedURI();

			//
			//  Abort the last http request if it's still there for some reason.
			//
			if (RsstlerFeeds.httpReq) {
				RsstlerFeeds.httpReq.abort();
			}

			RsstlerFeeds.httpReq = Cc["@mozilla.org/xmlextras/xmlhttprequest;1"].createInstance(Ci.nsIXMLHttpRequest);
			// RsstlerFeeds.httpReq.mozBackgroundRequest = true;
			// RsstlerFeeds.httpReq.parent = RsstlerFeeds.headReq.parent;
			RsstlerFeeds.httpReq.open("GET", url);
			RsstlerFeeds.httpReq.timeout = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_WAIT_FOR_RESPONSE);
			//
			//  The real work will happen in RsstlerFeeds.httpLoaded
			//
			RsstlerFeeds.httpReq.addEventListener("load", RsstlerFeeds.httpLoaded, false);
			RsstlerFeeds.httpReq.addEventListener("error", RsstlerFeeds.httpError, false);
			// RsstlerFeeds.httpReq.addEventListener("abort", RsstlerFeeds.httpError, false);
			RsstlerFeeds.httpReq.addEventListener("timeout", RsstlerFeeds.httpTimeout, false);

			try {
				RsstlerFeeds.httpReq.setRequestHeader("User-Agent", RsstlerUtils.USER_AGENT);
				RsstlerFeeds.httpReq.send();
			} catch(e) {
				// FAILURE
				RsstlerLogger.warn("Error sending http request: "+e);
				RsstlerFeeds.httpReq.abort();
				RsstlerFeeds.httpReq = null;
				RsstlerFeeds.check();
			}

		},

		httpError: function(e) {
			RsstlerLogger.warn("Error during http request: "+e);
			RsstlerFeeds.httpReq = null;
			RsstlerFeeds.check();
		},

		httpTimeout: function(e) {
			// RsstlerLogger.warn("Timeout during http request: "+e);
			RsstlerFeeds.httpReq = null;
			RsstlerFeeds.check();
		},

		//
		//  Now that the URL has been successfully loaded, we attempt to parse it.  The last argument to parse
		//  is an observer from whom onFeedParsed() will be called when the parse is done; that's where the 
		//  work will be done.
		//
		httpLoaded: function(e) {
			var count = 0;
			if (RsstlerFeeds.httpReq.status >= 200 && 
					RsstlerFeeds.httpReq.status <= 299 && 
					RsstlerFeeds.httpReq.responseText != null) {
				// RsstlerLogger.info("About to parse new feed items for "+RsstlerFeeds.lastHead);
				try {
					count = RsstlerFeeds.feedParser.parse(RsstlerFeeds.httpReq.responseText, RsstlerFeeds.lastFeed);
				} catch (e) {
					RsstlerLogger.warn("Exception in feedParser: "+e);
					count = 0;
				}
			};
			if (count > 0) {
				RsstlerLogger.info("Found "+count+" new items in "+RsstlerFeeds.lastFeed.getTitle());
				// RsstlerLogger.info("Refresh with "+RsstlerFeeds.lastFeed.getItemId());
				RsstlerFeeds.notifyObservers("rsstlerRefresh", RsstlerFeeds.lastFeed.getItemId());	
			}
			RsstlerFeeds.httpReq = null;
			RsstlerFeeds.check();
		},

		//
		//  Here's where the parsed feed will be dealt with.  If all was successful, we copy information from the 
		//  constructed feed into our actual feed.  (We don't want to do this until we know we can successfully parse
		//  the whole feed.)  Information on the constructed feed replaces information on the existing feed, except 
		//  for feedItems, where we simply keep the new ones.  This is all handled in rsstlerFeed.update();
		//
		onFeedParsed : function(count) {
			if (count > 0) {
				//  Since there was actually a change, we notify the UI to refresh
				RsstlerFeeds.notifyObservers("rsstlerRefreshed", "");	
			};
		},

}
