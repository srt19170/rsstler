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
var EXPORTED_SYMBOLS = ["rsstlerFeedParser"];

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");
Components.utils.import("resource://rsstler/rsstlerLogger.jsm");

var Cc = Components.classes;
var Ci = Components.interfaces;
var Cr = Components.results;
var Cu = Components.utils;

var loader = Cc["@mozilla.org/moz/jssubscript-loader;1"].getService(Ci.mozIJSSubScriptLoader);
loader.loadSubScript("chrome://rsstler/content/rsstlerFeed.js");
loader.loadSubScript("chrome://rsstler/content/rsstlerFeedItem.js");
loader.loadSubScript("chrome://rsstler/content/rsstlerFeedItemEnclosure.js");

function rsstlerFeedParser() {
};

rsstlerFeedParser.prototype = {

		feed: null,
		_count: 0,

		discover : function(feedText) {
			return true;
		},
		
		//
		//  Since we're using parseFromString here, this function is synchronous.  
		//
		parse : function(feedText, feed) {
			this.feed = feed;
			this._count = 0;
			var parser = Cc["@mozilla.org/feed-processor;1"].createInstance(Ci.nsIFeedProcessor);

			try {
				parser.listener = this;
				var URI = Components.classes["@mozilla.org/network/standard-url;1"].createInstance(Components.interfaces.nsIURI);
				URI.spec = feed.getFeedURI();
				parser.parseFromString(feedText, URI);
			} catch (e) {
				RsstlerLogger.info("Exception in feedParser.parse = "+e);
			}
			return this._count;
		},

		// nsIFeedResultListener
		//
		//  Modified to fill in an existing feed.  Adding items is straightforward, but we might have to 
		//  update other feed information (e.g., title).
		//
		handleResult : function(result) {

			//
			//  We need to wrap this in a try-catch because any error here results in the feed checker getting "hung"
			//
			try {
				// var FeedItem = new Components.Constructor("@rsstler.mozdev.org/rsstler/feeditem;1", "rsstlerIFeedItem", "init");
				// var FeedItemEnclosure = new Components.Constructor("@rsstler.mozdev.org/rsstler/feeditemenclosure;1", "rsstlerIFeedItemEnclosure", "init");

				if (!result || !result.doc) {
					return;
				}

				var rsstlerFeed = this.feed;
				
				if (!rsstlerFeed) return;
				
				var feed = result.doc;
				feed.QueryInterface(Ci.nsIFeed);

				var title = feed.title ? feed.title.plainText() : null;
				var link = feed.link ? feed.link.spec : null;
				var description = feed.subtitle ? feed.subtitle.plainText() : null;
				var author = null;
				if (feed.authors && feed.authors.length) {
					author = feed.authors.queryElementAt(0, Ci.nsIFeedPerson).name;
				}
				// var format = result.version;

				//
				//  Set the elements of the feed
				//
				if (title != null) rsstlerFeed.setTitle(title);
				if (link != null) rsstlerFeed.setLink(link);
				if (description != null) rsstlerFeed.setDescription(description);
				if (author != null) rsstlerFeed.setAuthor(author);
				//
				//  Probably don't want to do this.
				//
				// var feedURI = null;
				// if (result.uri) {
				//	feedURI = result.uri.spec;
				// }
				// if (feedURI != null) rsstlerFeed.setFeedURI(feedURI);

				var feedItems = feed.items;
				
				if (!feedItems) return;
				
				var feedItem, item, date, enc;
				var newestPubDate = null;
				var count = 0;
				
				//
				//  Add feed
				for (var i = 0; i < feedItems.length; i++) {
					feedItem = feedItems.queryElementAt(i, Ci.nsIFeedEntry);

					item = { title : "", link : "", author : "", content : "", pubDate : "", enclosure : null, baseURI : "" };

					//
					//  Date processing first.
					//
					date = null;
					if (feedItem.published) {
						date = feedItem.published;
					} else if (feedItem.updated) {
						date = feedItem.updated;
					}
					if (date) {
						try {
							item.pubDate = Date.parse(date);
						} catch (e) {
							RsstlerLogger.warn("unable to parse RFC822 date string: " + date + " feed: " + title);
						}
					}
					//
					//  If the pubDate of this item is older than the lastPubDate of the feed, we've already
					//  seen it, so we're done parsing.
					//
					if (rsstlerFeed.hasLastPubDate() && 
						item.pubDate != "" &&
						item.pubDate <= rsstlerFeed.getLastPubDate()) {
						// RsstlerLogger.info("Early break based on lastPubDate for "+this.feed.getTitle());
						break;
					};
					//
					//  Save the most new item for the lastPubDate update.  That should be the first one
					//  in the stream.
					//
					if (newestPubDate == null || item.pubDate > newestPubDate) newestPubDate = item.pubDate;

					if (feedItem.baseURI) {
						item.baseURI = feedItem.baseURI.spec;
					}
					if (feedItem.title) {
						item.title = feedItem.title.plainText();
					}
					if (feedItem.link) item.link = feedItem.link.spec;
					if (feedItem.authors && feedItem.authors.length) {
						item.author = feedItem.authors.queryElementAt(0, Ci.nsIFeedPerson).name;
					}
					item.content = feedItem.content ? feedItem.content.text : (feedItem.summary ? feedItem.summary.text : "");
					if (feedItem.enclosures && feedItem.enclosures.length) {
						enc = feedItem.enclosures.queryElementAt(0, Ci.nsIWritablePropertyBag2);
						if (enc.hasKey("url")) {
							// RsstlerLogger.info("Making an enclosure for "+rsstlerFeed.getTitle()+" article "+item.title);
							item.enclosure = new rsstlerFeedItemEnclosure(enc.get("url"), enc.hasKey("length") ? enc.get("length") : null, enc.hasKey("type") ? enc.get("type") : null);
						}
					}

					rsstlerFeed.addItem(new rsstlerFeedItem(item.title, item.link, item.author, item.content, item.pubDate, item.enclosure, item.baseURI));
					count++;
				}
				//
				//  Save the count on the feed in case we want to check whether we found anything
				//
				this._count = count;
				// 
				//  Update the lastPubDate
				//
				rsstlerFeed.setLastPubDate(newestPubDate);
			} catch (e) {
				RsstlerLogger.info("Feed parser exception = "+e);
				this._count = 0;
			}; 
		},
};