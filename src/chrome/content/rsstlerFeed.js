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
// Components.utils.import("resource://rsstler/RsstlerFeeds.jsm");
Components.utils.import("resource://rsstler/rsstlerLogger.jsm");

// var EXPORTED_SYMBOLS = ["rsstlerFeed"];

var Cc = Components.classes;
var Ci = Components.interfaces;

/******************************************************************************
 * rsstlerFeed Component
 ******************************************************************************/
function rsstlerFeed() {
	if (arguments.length == 2) {
		this.initId(arguments[0], arguments[1]);
	} else if (arguments.length == 7){
//		init: function(itemId, title, link, description, author, fURI, format)
		rsstlerFeed.prototype.init.apply(this, arguments);
	} else {
		throw "Invalid number of arguments to new rsstlerFeed().";
	}
};
rsstlerFeed.prototype = {

		bmsvc: Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Ci.nsINavBookmarksService),
		ios: Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService),
		_title: null,
		_link: null,
		_description: null,
		_author: null,
		_fURI: null,
		_format: null,
		_items: null,               // Must init this before using!
		_lastPubDate: null,
		_itemId: 0,
		_lastUpdate: null,              // Last time this feed was updated
		LASTREAD_KEYWORD: "lastRead",   // Keyword used to save lastReadItem on URL
		_lastReadDateLocal: null,       // pubDate of the last read feed item based upon user's local actions
		_lastReadDateRemote: null,	    // pubDate of the last read feed item based upon the URL annotation
		_broken: 0,                     // True if we can't reach the feed

		init: function(itemId, title, link, description, author, fURI, format)
		{
			this._itemId = itemId;
			this._title = title;
			this._link = link;
			this._description = description;
			this._author = author;
			this._lastReadDateLocal = 0;
			this._lastReadDateRemote = 0;
			this.setFeedURI(fURI);
			this._format = format;
			this._items = new Array();
			this._itemId = 0;
			this._lastUpdate = null;
			this._broken = 0;
		},

		initId: function(itemId, fURI)
		{
			this._lastReadDateLocal = 0;
			this._lastReadDateRemote = 0;
			this._items = new Array();
			this._itemId = itemId;
			this.setFeedURI(fURI);
			this._broken = 0;
		},

		//
		//  Update from the newly-read feed into the existing one.  Note that we'll
		//  copy in all the items; only the non-duplicates will be kept.
		//
		update: function(feed) {
			if (feed.getTitle()) this._title = feed.getTitle();
			if (feed.getLink()) this._link = feed.getLink();
			if (feed.hasDescription()) this._description = feed.getDescription();
			if (feed.hasAuthor()) this._author = feed.getAuthor();
			if (feed.hasLastPubDate() && 
					feed.getLastPubDate() > this.getLastPubDate())
				this._lastPubDate = feed.getLastPubDate();
			var lbefore = this._items.length;
			for(var i=0;i<feed.getItemCount();i++)
				this.addItem(feed.getItem(i));
			// RsstlerLogger.info("Updating "+this.getTitle()+" with "+(this._items.length-lbefore)+" new items.");
		},

		addItem: function(item)
		{
			// 
			//  Check to see if this is a duplicate
			//
			for(var i = 0; i < this._items.length; i++)
				if (this._items[i].getUID() == item.getUID()) return this._items[i];

			this._items.push(item);
			
			//
			//  Backpointer to this feed.
			//
			item.setFeed(this);

			//
			//  If the item is older than our lastItemRead, then mark it read as well.
			//
			// RsstlerLogger.info("In "+this.getTitle()+" lastReadDate = "+this._lastReadDate+" and item.getPubDate() = "+item.getPubDate());
			if (item.getPubDate() <= this._lastReadDateLocal) {
				item.setRead();  
			};
			
			return item;
		},

		//
		//  The integer portion of the UID is the millisecond posting date for the item.  We assume
		//  that these are unique; if they're not we may possibly have some problems where we treat
		//  items with the same time stamp as incorrectly read or unread.
		//
		notifyItemReadTime: function (pubDate) {
			if (pubDate > this._lastReadDateLocal) {
				this._lastReadDateLocal = pubDate;
				//
				//  Save this in both the feed URL (so it can be picked up by other computers) and locally
				//  in the database, so we can distinguish the local time from the remote time.
				//
				this.saveInURI(this.LASTREAD_KEYWORD, pubDate);
				RsstlerFeeds.dumpLRDLtoDB(this);
			}
		},
		
		getLastReadDate: function() {
			return this._lastReadDateLocal;
		},

		//
		//  Check to see if any of the items in this feed are unread
		//
		hasUnreadItems: function() {
			for(var i = 0; i < this._items.length; i++)
				if (!this._items[i].getRead()) return true;

			return false;
		},

		getLastUpdate: function()
		{
			return this._lastUpdate;
		},

		setLastUpdate: function(u) {
			this._lastUpdate = u;
		},

		hasItemId: function()
		{
			return Boolean(this._itemId);
		},

		getItemId: function()
		{
			return this._itemId;
		},

		setItemId: function(itemId)
		{
			this._itemId = itemId;
		},

		hasFeedURI: function()
		{
			return Boolean(this._fURI);
		},

		getFeedURI: function()
		{
			return this._fURI;
		},

		//
		//  If we get an updated lastReadDate for this feed, we go through and "read" all the older posts.
		//
		readOldPosts: function(d) {
			for(var i=0;i<this._items.length;i++) {
				// RsstlerLogger.info("In readOldPosts item["+i+"] = "+this._items[i].getPubDate());
				//
				//  We mark this as read if it is older than "d".  If we're always keeping our locally
				//  saved items, then we only mark this if it isn't saved.
				if (this._items[i].getPubDate() <= d && 
					!this._items[i].getRead() && 
						(!RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_ALWAYS_KEEP_LOCAL) || 
								!this._items[i].isSaved())) {
					RsstlerLogger.info("In readOldPosts for "+this.getTitle()+" marking read: "+this._items[i].getTitle());
					this._items[i].setRead();
				};
			};
		},
		
		//
		//  When setting the feed URI, check to see if has an encoded last read date (e.g., from a 
		//  different machine) and make use of it.
		//  
		setFeedURI: function(fURI) 	{
			//
			//  If this feed URI is annotated, we want to make use of that info.  
			//
			var lastRead = this.getAnnotationValue(fURI,this.LASTREAD_KEYWORD);
			if (lastRead) {
				// RsstlerLogger.info("In setFeedURI for "+fURI+" lastRead = "+lastRead);
				this._lastReadDateRemote = lastRead;
				if (this._lastReadDateLocal == 0 || 
						(this._lastReadDateRemote > this._lastReadDateLocal &&
						 RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_USE_REMOTE_LAST_READ))) {
					this.readOldPosts(this._lastReadDateRemote);
					this._lastReadDateLocal = this._lastReadDateRemote;
				};
			}
			//
			//  Now save a cleaned up URI
			//
			this._fURI = this.cleanURI(fURI,this.LASTREAD_KEYWORD);
		},

		//
		//  This function removes a keyword annotation from a URL
		//
		cleanURI: function (URL,keyword) {
			var re1 = new RegExp("([\?&])"+keyword+"=[^&]*&");
			var re2 = new RegExp("[\?&]"+keyword+"=[^&]*$");
			if (re1.test(URL)) {
				return URL.replace(re1,"$1");
			} else if (re2.test(URL)) {
				return URL.replace(re2, "");
			};
			return URL;
		},

		//
		//  This function annotates a URL with a keyword and value
		//
		annotateURI: function(URL,keyword,value) {
			//
			//  First remove if present.
			//
			var cleanURL = this.cleanURI(URL,keyword);
			//
			//  Now add to the end with
			//
			if (cleanURL.indexOf("?") > -1) {
				return cleanURL + "&" + keyword + "=" + value;
			} else {
				return cleanURL + "?" + keyword + "=" + value;
			}
		},

		saveInURI: function(keyword,val) {
			//
			//  Save this to the bookmark URI.  Note we can suspend the bookmark listener 
			//  here, since we know we are the source of this update.
			//
			if (this._itemId != null) {
				var annoURI = this.annotateURI(this._fURI,keyword,val);
				var uri = this.ios.newURI(annoURI, null, null);
				this.bmsvc.changeBookmarkURI(this._itemId,uri);
			}
		},

		getAnnotationValue: function(URL, keyword) {
			var re1 = new RegExp("[\?&]"+keyword+"=([^&]*)$");
			if (re1.test(URL)) {
				return URL.match(re1)[1];
			};
			var re2 = new RegExp("[\?&]"+keyword+"=([^&]*)&");
			if (re1.test(URL)) {
				return URL.match(re2)[1];
			};
			return null;
		},

		getTitle: function()
		{
			return this._title;
		},

		setTitle: function(title)
		{
			this._title = title;
		},

		hasDescription: function()
		{
			return Boolean(this._description);
		},

		getDescription: function()
		{
			return this.hasDescription() ? this._description : null;
		},

		setDescription: function(descr)
		{
			this._description = descr;
		},

		getLink: function()
		{
			return this._link;
		},

		setLink: function(link)
		{
			this._link = link;
		},

		hasAuthor: function()
		{
			return Boolean(this._author);
		},

		getAuthor: function()
		{
			return this.hasAuthor() ? this._author : null;
		},

		setAuthor: function(author)
		{
			this._author = author;
		},

		hasLastPubDate: function()
		{
			return Boolean(this._lastPubDate);
		},

		getLastPubDate: function()
		{
			return this.hasLastPubDate() ? this._lastPubDate : null;
		},

		setLastPubDate: function(date)
		{
			if (date != null && (this._lastPubDate == null || date > this._lastPubDate)) this._lastPubDate = date;
		},
		
		//
		//  Get the bookmark for this feed and see if the URL has changed.  If it has, we can
		//  update the read status of posts accordingly.
		//
		checkChangedURL: function() {
			var feed = this;
			var oldIRT = feed.getLastReadDate();
			// Get the URL off the bookmark
			var url = this.bmsvc.getBookmarkURI(this._itemId).spec;
			var newIRT = feed.getAnnotationValue(url, feed.LASTREAD_KEYWORD);
			// RsstlerLogger.info("Checking URL for "+feed.getTitle()+" oldIRT = "+oldIRT+" newIRT = "+newIRT);
			if (newIRT == oldIRT) {
				// Do nothing
			} else if (newIRT > oldIRT) {
				feed.readOldPosts(newIRT);
				feed.notifyItemReadTime(newIRT);
			} else {
				// 
				//  The newIRT is older than the previous IRT, so we need to rewrite it
				//  with the previous IRT.  This will also cause an onItemChanged bookmark
				//  event, but it will be the newIRT == oldIRT case above.
				//
				feed.saveInURI(feed.LASTREAD_KEYWORD, oldIRT);
			};
		},

		getItemCount: function()
		{
			return this._items.length;
		},
		
		getItem: function(i) {
			return this._items[i];
		},

		getUnreadItemCount: function() {
			var count = 0;

			for(var i = 0; i < this._items.length; i++)
				if (!this._items[i].getRead()) count++;

			return count;
		},

		getItems: function() {
			return this._items;
		},

		getFormat: function()
		{
			return this._format;
		},
		
		//
		//  Notify observers of an event
		//
		notifyObservers: function(aEvent, aValue) {
			var observerService = Cc["@mozilla.org/observer-service;1"]
			.getService(Ci.nsIObserverService);
			observerService.notifyObservers(null, aEvent, aValue);
		},


		isBroken: function()
		{
			return (this._broken > 2);
		},
		
		setBroken: function()
		{
			this._broken++;
			if (this._broken == 3) this.notifyObservers("rsstlerRefresh", RsstlerFeeds.lastFeed.getItemId());	

		},
		
		clearBroken: function()
		{
			var oldBroken = this._broken;
			this._broken = 0;
			if (oldBroken > 0) this.notifyObservers("rsstlerRefresh", RsstlerFeeds.lastFeed.getItemId());	
		},

		//
		//  Local database save & restore 
		//

		//
		//  This makes the object we save in the database -- basically just the minimum
		//  we need to recreate the feedItem
		//

		makeDBobj: function (fURI, feedItem) {

			return { feedURI: fURI,
				title: feedItem.getTitle(), 
				link: feedItem.getLink(),
				author: feedItem.getAuthor(), 
				content: feedItem.getContent(),
				pubDate: feedItem.getPubDate(), 
				baseURI: feedItem.getBaseURI() };  
		},
		
		//
		//  Save the lastReadDateLocal out to the database.
		//
		saveLRDL: function(objectStore) {
			var request;
			// RsstlerLogger.info("Saving key = "+this._fURI+" LRDL: "+this._lastReadDateLocal);
			try {
				request = objectStore.put({ fURL: this._fURI, LRDL: this._lastReadDateLocal });
			} catch (e) {
				RsstlerLogger.info("Exception while putting LRDL: "+e);
			};
			request.onerror = function (event) {
				RsstlerLogger.info("objectStore.put error saving LDRL:"+event);
			};
			request.onsuccess = function (event) {
				// RsstlerLogger.info("objectStore.put success saving LDRL, key = "+event.target.result);
			};
		},

		//
		//  Save all unread feed items.  We're passed in the objectStore here, because we trying to 
		//  do this all in one transaction.
		//
		saveDB: function (objectStore, add_limit) {
			var feed = this;
			//
			//  Add items
			//
			var num_added = 0;
			for (var i = 0; i < this._items.length && num_added < add_limit ; i++) {
				//
				//  Only save unread Feeds items.
				//
				var feedItem = this._items[i];
				if (!feedItem.getRead()) {
					//
					//  The object we push onto the store contains only the fields we care
					//  about.
					//
					num_added++;
					var request = objectStore.add(this.makeDBobj(this._fURI, feedItem));
					request.onerror = function (event) {
						RsstlerLogger.info("objectStore.add error on "+feedItem+" database: "+event);
					};
				};
			};
		},
		
		//
		//  Load the lastReadDateLocal from the database
		//
		loadLRDLFromDB: function (db, osName) {
			var feed = this;
			//
			//  Make sure the DB exists
			//
			if (db == null) {
				RsstlerLogger.info("No RsstlerFeeds.db in loadLRDLFromDB?");
				return;
			};
			//
			//  Create a transaction.  If this fails, return so that we don't break the rest of Rsstler.
			//
			var transaction;
			try {
			   transaction = db.transaction([osName], "readonly");
			} catch (e) {
				RsstlerLogger.info("DB transaction failed in loadLRDLFromDB.");
				return;
			};
			if (transaction == null) {
				RsstlerLogger.info("Error creating transaction in loadLRDLFromDB.");
				return;
			};
			transaction.onerror = function (event) {
				RsstlerLogger.info("loadLRDLFromDB transaction error: "+event);
			};
			var objectStore = transaction.objectStore(osName);
			var request = objectStore.get(feed._fURI);
			request.onerror = function(event) {
				RsstlerLogger.info("loadLRDLFromDB request error: "+event);

			};
			request.onsuccess = function(event) {
				if (!request.result) return;
				// RsstlerLogger.info("loadLRDL success for "+feed._fURI+" LRDL: "+request.result.LRDL);
				var lastRead = event.target.result.LRDL;
				//
				//  If we've been told to ignore any remote lastReadDates, then we're going to 
				//  use this date.  Otherwise, we'll only use it if it is older than our remote
				//  date.
				//
				if (!RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_USE_REMOTE_LAST_READ) ||
						lastRead > feed._lastReadDateRemote) {
					feed._lastReadDateLocal = lastRead;
				};
				// 
				//  The lastPubDate should be older than this; if it's not use this.
				//
				feed.setLastPubDate(lastRead);
			};
		},

		//
		//   Read the DB and construct feed items accordingly.  
		//
		loadFeedItemsFromDB: function (db, osName, alwaysKeepSaved) {
			// RsstlerLogger.info("In loadDB for "+this.getFeedURI());
			var feed = this;
			// var FeedItem = new Components.Constructor("@rsstler.mozdev.org/rsstler/feeditem;1", "rsstlerIFeedItem", "init");
			
			//
			//  Make sure the DB exists
			//
			if (db == null) {
				RsstlerLogger.info("No RsstlerFeeds.db in loadDB?");
				return;
			};
			//
			//  Create a transaction.  If this fails, return so that we don't break the rest of Rsstler.
			//
			var transaction;
			try {
			   transaction = db.transaction([osName], "readonly");
			} catch (e) {
				RsstlerLogger.info("DB transaction failed in loadDB.");
				return;
			};
			if (transaction == null) {
				RsstlerLogger.info("Error creating transaction in loadDB.");
				return;
			};
			transaction.onerror = function (event) {
				RsstlerLogger.info("loadDB transaction error: "+event);
			};
			var objectStore = transaction.objectStore(osName);
			//
			//  Now we need to walk through all the entries in objectStore corresponding
			//  to this feed and add them.
			//
			var index = objectStore.index("feedURI");
			var singleKeyRange = RsstlerFeeds.IDBKeyRange.only(feed._fURI);

			index.openCursor(singleKeyRange).onsuccess = function(event) {
				var cursor = event.target.result;
				if (cursor) {
					var item = cursor.value;
					var feedItem = new rsstlerFeedItem(item.title, item.link, item.author, item.content, item.pubDate, null, item.baseURI); 
					feed.addItem(feedItem);
					// RsstlerLogger.info("Adding "+item.title+" to "+feed.getTitle());
					//
					//  Push in the lastPubDate
					//
					feed.setLastPubDate(item.pubDate);
					//
					// If we're keeping all our locally saved items, then make sure that this item is 
					// "unread" even if feed.lastItemRead would indicate elsewise
					//
					if (alwaysKeepSaved) {
						feedItem.setUnread();
						feedItem.setSaved();
					};
					cursor.continue();
				} else {
					// RsstlerLogger.info("End of openCursor, event = "+event);
				};
			};
		}
};
