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

var Cc = Components.classes;
var Ci = Components.interfaces;

var TreeView = {

    hist: Cc["@mozilla.org/browser/nav-history-service;1"].getService(Ci.nsINavHistoryService),
    bmsvc: Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Ci.nsINavBookmarksService),
    domIndex: new Object(),
    
    //
    //  A folder is unread if any of its contained feeds is unread
    //
    folderUnread: function(aNode) {
	aNode.QueryInterface(Components.interfaces.nsINavHistoryContainerResultNode);
	aNode.containerOpen = true;
	for (var i = 0; i < aNode.childCount; i ++) {
	    var itemId = aNode.getChild(i).itemId;
	    var feed = RsstlerFeeds.getFeedById(itemId);
	    if (feed && feed.hasUnreadItems()) return true;
	}
	return false;
    },
    
    addAttributes: function (element, attrs) {
	for(var i=0;i<attrs.length;i += 2) {
	    element.setAttribute(attrs[i],attrs[i+1]);
	}
	
    },
    
    //
    //  Take a simple bookmark and produce the DOM to represent it.
    //
    makeBookmarkHTML: function(itemId) {
	var feed = RsstlerFeeds.getFeedById(itemId);
	if (feed == null) {
	    RsstlerLogger.warn(" Null feed for item = "+itemId+"?");
	    return "";
	}
	var stateAttr = new Array();
	
	if (feed.hasUnreadItems()) {
	    stateAttr.push("unread");
	    stateAttr.push(feed.getUnreadItemCount());
	} else if (feed.getItemCount() > 0) {
	    stateAttr.push("read");
	    stateAttr.push(feed.getItemCount());
	} else {
	    stateAttr.push("empty");
	    stateAttr.push(true);
	};
	
	if (feed.isBroken()) {
	    stateAttr.push("broken");
	    stateAttr.push(true);
	}
	
	var li = RsstlerUtils.makeElement("li","leaf");
	this.addAttributes(li,stateAttr);
	li.addEventListener("click", function() { rsstlerUI.display(itemId);}, false);
	li.setAttribute("url",feed.getFeedURI());
	var div1 = RsstlerUtils.makeElement("div","leafAll");
	div1.addEventListener("click", function() { rsstlerUI.display(itemId);}, false);
	var div2 = RsstlerUtils.makeElement("div","leafStart");
	div2.addEventListener("click", function() { rsstlerUI.display(itemId);}, false);
	var div3 = RsstlerUtils.makeElement("div","leafTitle");
	div3.addEventListener("click", function() { rsstlerUI.display(itemId);}, false);
	this.addAttributes(div3,stateAttr);
	div3.textContent = feed.getTitle();
	div3.itemId = itemId;
	var div4 = RsstlerUtils.makeElement("div","leafUnreadCount");
	div4.textContent = " (" + feed.getUnreadItemCount() + ")";
	this.addAttributes(div4,stateAttr);
	div2.appendChild(div3);
	div2.appendChild(div4);
	div1.appendChild(div2);
	li.appendChild(div1);
	return li;
    },
    
    //
    //  Tries to just update the "unread" on a folder.
    //
    updateFolderDOM: function(itemId) {
	var oldTreeDOM = TreeView.domIndex[itemId];
	if (oldTreeDOM == null) {
	    RsstlerLogger.info("No oldTreeDom in updateFolderDom for "+itemId);
	    return;
	}
	var node = RsstlerUtils.getNodeFromItemId(itemId);
	var unread = TreeView.folderUnread(node);
	//
	//  div4 is the part of the folder DOM that contains "unread" and (right now)
	//  the only part we need to update.
	//
	var div4 = oldTreeDOM.firstChild.firstChild.childNodes[1];
	if (div4 == null) {
	    RsstlerLogger.info("No div4 in updateFolderDom for "+itemId);
	    return;
	}
	if (unread) {
	    div4.setAttribute("unread",true);
	} else {
	    div4.removeAttribute("unread");
	};
    },
    
    //
    //   If this is a bookmark, return the folder it is in.
    //
    getItemFolderId: function(itemId) {
	return TreeView.bmsvc.getFolderIdForItem(itemId);
    },
    
    //
    //   This version rewrites all the DOM from this point downward.  If this is not a folder, 
    //   then we go upwards to the enclosing folder and update that as well.
    //
    //   Note that if this item is in a closed folder, it doesn't have a TreeDOM, so we can ignore
    //   that part.
    //
    updateTreeDOM: function(itemId) {
	var oldTreeDOM = TreeView.domIndex[itemId];
	var feed = RsstlerFeeds.getFeedById(itemId);
	//
	//  Fix the display of this item
	//
	if (oldTreeDOM != null) {
	    var newTreeDOM = TreeView.makeHTML(itemId, false);
	    oldTreeDOM.parentNode.replaceChild(newTreeDOM, oldTreeDOM);
	    TreeView.domIndex[itemId] = newTreeDOM;
	};
	// 
	//  Fix the display of this folder
	//
	var folderId = TreeView.getItemFolderId(itemId);
	TreeView.updateFolderDOM(folderId);
    },
    
    //
    // <li class="folder"> 
    //  <div1 class="folderAll">
    //     <div2 class="folderStart">
    //        <div3 class="folderIconOpen" onclick="rsstlerUI.toggleFolder(206)"></div>
    //        <div4 class="folderTitle" onclick="rsstlerUI.display(206);" unread="1">What's Hot</div>
    //     </div>
    //  </div>
    //  **  <ul class="folderList">...</ul></li>
    //
    makeFolderHTMLStart: function(itemId, open, unread) {
	var folderIconClass = "folderIconClosed";
	if (open) folderIconClass = "folderIconOpen";
	
	var li = RsstlerUtils.makeElement("li","folder");
	var div1 = RsstlerUtils.makeElement("div","folderAll");
	var div2 = RsstlerUtils.makeElement("div","folderStart");
	var div3 = RsstlerUtils.makeElement("div", folderIconClass);
	div3.addEventListener("click", function() { rsstlerUI.toggleFolder(itemId);}, false);
	var div4 = RsstlerUtils.makeElement("div", "folderTitle");
	div4.addEventListener("click", function() { rsstlerUI.display(itemId);}, false);
	if (unread) div4.setAttribute("unread",true);
	var title = this.bmsvc.getItemTitle(itemId);
	RsstlerLogger.info("In makeFolderHTMLStart title: "+title);
	// Remove the "*" that indicates this folder is open if necessary
	if (title.indexOf("*") != -1) title = title.substring(0,title.length-1);
	RsstlerLogger.info("In makeFolderHTMLStart fixed title: "+title);
	div4.textContent = title;
	div4.itemId = itemId;
	div2.appendChild(div3);
	div2.appendChild(div4);
	div1.appendChild(div2);
	li.appendChild(div1);
	return li;
    },

    //
    //  Check to see if a folder is "open" by looking at its keyword and making sure it 
    //  isn't "closed"
    //
    isFolderOpen: function(itemId) {
	var title = rsstlerUI.bmsvc.getItemTitle(itemId);
	var kw = title.indexOf("*");
	return (kw == -1);
    },

    //
    //  Make a treeview starting at itemId
    //
    makeHTML: function(itemId) {
	var doc = null;
	var itemType = null;
	try {
	    itemType = this.bmsvc.getItemType(itemId);
	} catch (e) {
	    RsstlerLogger.warn("itemId is invalid: "+itemId);
	    return null;
	};
	// RsstlerLogger.info("Entering makeHTML with "+this.bmsvc.getItemTitle(itemId)+" id = "+itemId);			
	if (itemType == this.bmsvc.TYPE_BOOKMARK) {
	    //
	    //  Add the HTML for a simple bookmark here.
	    //
	    doc = this.makeBookmarkHTML(itemId);
	} else if (itemType == this.bmsvc.TYPE_FOLDER) {
	    var aNode = RsstlerUtils.getNodeFromItemId(itemId);
	    var open = this.isFolderOpen(itemId);
	    var unread = this.folderUnread(aNode);
	    doc = this.makeFolderHTMLStart(itemId, open, unread);
	    var ul = RsstlerUtils.makeElement("ul","folderList");
	    // 
	    //  If the folder is open, add its children to the <ul>
	    //
	    if (open) {
		aNode.QueryInterface(Components.interfaces.nsINavHistoryContainerResultNode);
		aNode.containerOpen = true;
		// RsstlerLogger.info(this.bmsvc.getItemTitle(itemId)+" is an open folder with "+aNode.childCount+" children.");
		for (var i = 0; i < aNode.childCount; i++) {
		    var child = this.makeHTML(aNode.getChild(i).itemId);
		    if (child != null) {
			ul.appendChild(child);
		    } else {
			RsstlerLogger.info("[oTD] Null HTML for itemId = "+aNode.getChild(i).itemId);
		    }
		}
		aNode.containerOpen = false;
	    }
	    doc.appendChild(ul);
	}
	// RsstlerLogger.info("  Returning: "+doc);
	TreeView.domIndex[itemId] = doc;
	return doc;
    }
};
