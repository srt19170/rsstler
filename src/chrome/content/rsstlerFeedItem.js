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
/******************************************************************************
 * rsstlerFeedItem Component
 ******************************************************************************/
function rsstlerFeedItem() {
	rsstlerFeedItem.prototype.init.apply(this, arguments);
};

rsstlerFeedItem.prototype = { 

  _title: null,
  _link: null,
  _author: null,
  _content: null,
  _pubDate: null,
  _enclosure: null,
  _baseURI: null,
  _feed: null,          // The feed this item belongs to
  _uid: 0,
  _read: false,                   // Has the item been read?
  _saved: false,    // The user has "saved" this item.

  init: function(title, link, author, content, pubDate, enclosure, baseURI)
  {
    this._title = title;
    this._link = link;
    this._author = author;
    this._content = content;
    this._pubDate = pubDate;
    this._enclosure = enclosure;
    this._baseURI = baseURI;
    this._uid = this.makeUID();
    this._read = false;
    this._feed = null;
    this._saved = false;
  },
  
  //
  //  A unique identifier for this item.  The date in milliseconds is probably sufficient,
  //  but we'll add in fractional part based upon the first few characters of the title.  
  //  We'll assume that the char codes are < 256.
  //
  makeUID: function() {
	var uid = this._pubDate;
	var frac = 0;
	for(var i=0; i < Math.min(3,this._title.length);i++)
		frac += this._title.charCodeAt(i);
	var all = uid + (frac / (3*256));
	return all;
  },
  
  getUID: function () {
	return this._uid;  
  },
  
  setFeed: function(feed) {
	this._feed = feed;  
  },
  
  getFeed: function() {
	  return this._feed;
  },
  
  getRead: function () {
	  return this._read;
  },

  //
  //  When we set a feed item as read, we want to let the feed know, so that
  //  it can update its feedLastRead if appropriate.
  //
  setRead: function () {
	  this._read = true;
	  if (this._pubDate) this._feed.notifyItemReadTime(this._pubDate);
  },
  
  setUnread: function () {
	  this._read = false;
  },
  
  //
  //  An item is "saved" if it came out of the database of unread (saved) items.  Such an 
  //  item does not get marked read just because the feed's last read date is later than
  //  the item's pubDate.
  //
  setSaved: function() {
	  this._saved = true;
  },
  
  isSaved: function() {
	  return this._saved;
  },
  
  hasTitle: function()
  {
    return Boolean(this._title);
  },
  
  getTitle: function()
  {
    var title;
    if (this.hasTitle()) {
      title = this._title;
    } else {
      if (this.hasContent()) {
        var temp = this.getContent();
        temp = temp.replace(/<.*?>/g, "");
        title = this._smartTrim(temp, 30, " ...");
      } else {
        title = null;
      }
    }
    return title;
  },
  
  hasAuthor: function()
  {
    return Boolean(this._author);
  },
  
  getAuthor: function()
  {
    return this.hasAuthor() ? this._author : null;
  },
  
  getLink: function()
  {
    return this._link;
  },
  
  hasContent: function()
  {
    return Boolean(this._content);
  },
  
  getContent: function()
  {
    return this.hasContent() ? this._content : null;
  },
  
  hasPubDate: function()
  {
    return Boolean(this._pubDate);
  },
  
  getPubDate: function()
  {
    return this.hasPubDate() ? this._pubDate : null;
  },
  
  hasEnclosure: function()
  {
    return Boolean(this._enclosure);
  },
  
  getEnclosure: function()
  {
    return this.hasEnclosure() ? this._enclosure : null;
  },
  
  hasBaseURI: function()
  {
    return Boolean(this._baseURI);
  },
  
  getBaseURI: function()
  {
    return this.hasBaseURI() ? this._baseURI : null;
  },
  
  _smartTrim: function(s, l, p) {
    var words = s.split(" ");
    var numWords = words.length;
    var output = [];
    var cwl, ol, cWord, w;
    ol = 0;
    for(w = 0; w < numWords; ++w) {
      cWord = words[w];
      cwl = cWord.length;
      if((ol + cwl) <= l) {
        output.push(cWord);
        ol += cwl + 1;
      } else {
        break;
      }
    }
    var trimmedString = output.join(" ");
    if (trimmedString == s) {
      return s;
    } else {
      return trimmedString + p;
    }
  },

};