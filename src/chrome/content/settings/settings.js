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

var rsstlerFolderID;

var chkUserCssEnable;
var txtUserCssPath;
var chkSbarCssEnable;
var txtSbarCssPath;
var chkAllowEContent;
var chkUseNewWindows;
var chkRenderFeeds;
var feedItemOrder;
var feedDiscoveryMode;
var fsNavNext;
var fsNavPrev;
var fsNavNextPage;
var fsNavMark;
var fsNavUnmark;
var fsOpenItem;
var chkAutoRead;
var groupByFeed;
var checkIntervalActive;
var checkIntervalInactive;
var waitForResponse;
var hideEmptyFeeds;
var hideReadFeeds;
var pageLimit;
var stopChecking;
var feedItemSaveLimit;
var useEndlessDisplay;
var useFixedDisplayHeader;
var showUpdateStatus;
var alwaysKeepLocal;
var useRemoteLastRead;
var navNextFeed;

var gList;
var strRes;

Components.utils.import("resource://rsstler/rsstlerLogger.jsm");

function init() {
	// var Logger = new Components.Constructor("@rsstler.mozdev.org/rsstler/logger;1", "rsstlerILogger", "init");
	strRes = document.getElementById("strRes");

	try {
		rsstlerFolderID = RsstlerUtils.getRsstlerRootFolderId();
	} catch (e) {
		RsstlerLogger.error(e);
	}

	gList = document.getElementById("select-menu");

	chkUserCssEnable = document.getElementById("chkUserCssEnable");
	chkUserCssEnable.checked = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_CSS_ENABLE);

	txtUserCssPath = document.getElementById("txtUserCssPath");
	txtUserCssPath.value = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_CSS_PATH);

	chkAllowEContent = document.getElementById("chkAllowEContent");
	chkAllowEContent.checked = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_ALLOW_ENCODED_CONTENT);

	chkUseNewWindows = document.getElementById("chkUseNewWindows");
	chkUseNewWindows.checked = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_USE_NEW_WINDOWS);

	stopChecking = document.getElementById("stopChecking");
	stopChecking.checked = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_STOP_CHECKING);

	feedItemOrder = document.getElementById("feedItemOrder");
	feedItemOrder.value = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_FEED_ITEM_ORDER);

	groupByFeed = document.getElementById("groupByFeed");
	groupByFeed.checked = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_GROUP_BY_FEED);

	hideEmptyFeeds = document.getElementById("chkHideEmptyFeeds");
	hideEmptyFeeds.checked = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_HIDE_EMPTY_FEEDS);

	hideReadFeeds = document.getElementById("chkHideReadFeeds");
	hideReadFeeds.checked = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_HIDE_READ_FEEDS);

	fsNavNext = document.getElementById("fsNavNext");
	fsNavNext.value = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_FS_NAVNEXT);

	fsNavPrev = document.getElementById("fsNavPrev");
	fsNavPrev.value = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_FS_NAVPREV);

	fsNavNextPage = document.getElementById("fsNavNextPage");
	fsNavNextPage.value = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_FS_NAV_NEXT_PAGE);

	fsNavMark = document.getElementById("fsNavMark");
	fsNavMark.value = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_FS_NAVMARK);

	fsNavUnmark = document.getElementById("fsNavUnmark");
	fsNavUnmark.value = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_FS_NAVUNMARK);

	fsOpenItem = document.getElementById("fsOpenItem");
	fsOpenItem.value = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_FS_OPENITEM);

	navNextFeed = document.getElementById("navNextFeed");
	navNextFeed.value = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_NAV_NEXT_FEED);

	pageLimit = document.getElementById("pageLimit");
	pageLimit.value = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_PAGE_LIMIT);

	feedItemSaveLimit = document.getElementById("feedItemSaveLimit");
	feedItemSaveLimit.value = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_FEED_ITEM_SAVE_LIMIT);

	chkAutoRead = document.getElementById("chkAutoRead");
	chkAutoRead.checked = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_AUTO_READ);

	checkIntervalActive = document.getElementById("checkIntervalActive");
	checkIntervalActive.value = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_CHECK_INTERVAL_ACTIVE)/1000;

	checkIntervalInactive = document.getElementById("checkIntervalInactive");
	checkIntervalInactive.value = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_CHECK_INTERVAL_INACTIVE)/1000;

	waitForResponse = document.getElementById("waitForResponse");
	waitForResponse.value = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_WAIT_FOR_RESPONSE)/1000;

	useEndlessDisplay = document.getElementById("useEndlessDisplay");
	useEndlessDisplay.checked = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_USE_ENDLESS_DISPLAY);

	useFixedDisplayHeader = document.getElementById("useFixedDisplayHeader");
	useFixedDisplayHeader.checked = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_USE_FIXED_DISPLAY_HEADER);

	showUpdateStatus = document.getElementById("showUpdateStatus");
	showUpdateStatus.checked = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_SHOW_UPDATE_STATUS);

	alwaysKeepLocal = document.getElementById("alwaysKeepLocal");
	alwaysKeepLocal.checked = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_ALWAYS_KEEP_LOCAL);

	useRemoteLastRead = document.getElementById("useRemoteLastRead");
	useRemoteLastRead.checked = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_USE_REMOTE_LAST_READ);

	setDisabled();
	fillSelectFolderMenupopup();
}

function accept() {
	// RsstlerUtils.setRsstlerRootFolderId(rsstlerFolderID);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_CSS_ENABLE, chkUserCssEnable.checked);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_CSS_PATH, txtUserCssPath.value);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_ALLOW_ENCODED_CONTENT, chkAllowEContent.checked);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_USE_NEW_WINDOWS, chkUseNewWindows.checked);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_STOP_CHECKING, stopChecking.checked);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_FEED_ITEM_ORDER, feedItemOrder.value);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_GROUP_BY_FEED, groupByFeed.checked);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_HIDE_EMPTY_FEEDS, hideEmptyFeeds.checked);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_HIDE_READ_FEEDS, hideReadFeeds.checked);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_FS_NAVNEXT, fsNavNext.value);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_FS_NAVPREV, fsNavPrev.value);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_FS_NAV_NEXT_PAGE, fsNavNextPage.value);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_FS_NAVMARK, fsNavMark.value);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_FS_NAVUNMARK, fsNavUnmark.value);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_FS_OPENITEM, fsOpenItem.value);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_NAV_NEXT_FEED, navNextFeed.value);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_PAGE_LIMIT, pageLimit.value);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_FEED_ITEM_SAVE_LIMIT, feedItemSaveLimit.value);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_AUTO_READ, chkAutoRead.checked);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_CHECK_INTERVAL_ACTIVE, checkIntervalActive.value*1000);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_CHECK_INTERVAL_INACTIVE, checkIntervalInactive.value*1000);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_WAIT_FOR_RESPONSE, waitForResponse.value*1000);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_USE_ENDLESS_DISPLAY, useEndlessDisplay.checked);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_USE_FIXED_DISPLAY_HEADER, useFixedDisplayHeader.checked);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_SHOW_UPDATE_STATUS, showUpdateStatus.checked);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_ALWAYS_KEEP_LOCAL, alwaysKeepLocal.checked);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_USE_REMOTE_LAST_READ, useRemoteLastRead.checked);

}


//This is duplicative of code in src/defaults/preferences/rsstler.js but I don't see any 
//easy way to avoid that.

function resetToDefaults() {
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_CSS_ENABLE, false);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_CSS_PATH, "");
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_ALLOW_ENCODED_CONTENT, true);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_USE_NEW_WINDOWS, true);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_STOP_CHECKING, false);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_FEED_ITEM_ORDER, "newestFirst");
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_GROUP_BY_FEED, false);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_FS_NAVNEXT, "j");
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_FS_NAVPREV, "k");
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_FS_NAV_NEXT_PAGE, "n");
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_FS_NAVMARK, "m");
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_FS_NAVUNMARK, "u");
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_FS_OPENITEM, "o");
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_NAV_NEXT_FEED, true);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_AUTO_READ, true);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_CHECK_INTERVAL_ACTIVE, 3*60*1000);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_CHECK_INTERVAL_INACTIVE, 15*60*1000);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_WAIT_FOR_RESPONSE, 2*1000);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_PAGE_LIMIT, 25);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_FEED_ITEM_SAVE_LIMIT, 100);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_USE_ENDLESS_DISPLAY, true);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_USE_FIXED_DISPLAY_HEADER, true);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_SHOW_UPDATE_STATUS, true);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_ALWAYS_KEEP_LOCAL, false);
	RsstlerUtils.setRsstlerPrefValue(RsstlerUtils.PREF_USE_REMOTE_LAST_READ, true);
	init();
}

function removeBrokenFeeds() {
	var rsstlerUI = window.arguments[0];

	if (rsstlerUI == null) {
		RsstlerLogger.info("Didn't get passed RsstlerUI?");
	}

	rsstlerUI.removeBrokenFeeds();
}

function selectFolder(aEvent){
	var newRsstlerFolderID = aEvent.target.id;
	//  If it's no different from the original, do nothing
	if (newRsstlerFolderID == rsstlerFolderID) return;
	//  Otherwise we use setNewRootFolder to update the root folder
	var rsstlerUI = window.arguments[0];
	rsstlerUI.notifyObservers("rsstlerWorking", name);
	rsstlerUI.setNewRootFolder(newRsstlerFolderID);
	rsstlerFolderID = newRsstlerFolderID;
	rsstlerUI.notifyObservers("rsstlerDone", name);
}

function setDisabled() {
	txtUserCssPath.disabled = !chkUserCssEnable.checked;
	document.getElementById("btnBrowseCss").disabled = !chkUserCssEnable.checked;
	pageLimit.disabled = useEndlessDisplay.checked;
}

function browseCss() {
	txtUserCssPath.value = _browseCss();
}

function _browseCss() {
	var fpicker = Components.classes["@mozilla.org/filepicker;1"]
	.createInstance(Components.interfaces.nsIFilePicker);
	fpicker.init(window, strRes.getString("css_select_file"), fpicker.modeOpen);
	fpicker.appendFilter(strRes.getString("css_css_file") + " (*.css)", "*.css");
	fpicker.appendFilters(fpicker.filterAll);

	var showResult = fpicker.show();
	if(showResult == fpicker.returnOK) {
		return fpicker.file.path;
	}
	return null;
}

function fillSelectFolderMenupopup() {
	var popup = document.getElementById("select-folder");

	// clearing the old menupopup
	while (popup.hasChildNodes()) {
		popup.removeChild(popup.firstChild);
	}

	var element = document.createElementNS(RsstlerUtils.XUL_NS, "menuitem");
	element.setAttribute("label", PlacesUtils.bookmarks.getItemTitle(PlacesUtils.bookmarks.bookmarksMenuFolder));
	element.setAttribute("id", PlacesUtils.bookmarks.bookmarksMenuFolder);
	popup.appendChild(element);

	var query = PlacesUtils.history.getNewQuery();
	query.setFolders([PlacesUtils.bookmarks.bookmarksMenuFolder], 1);
	var result = PlacesUtils.history.executeQuery(query, PlacesUtils.history.getNewQueryOptions());

	var folder = result.root;
	fillFolder(popup, folder, 1);

	if(gList.selectedIndex == -1) {
		gList.selectedIndex = 0;
		rsstlerFolderID = PlacesUtils.bookmarks.bookmarksMenuFolder; 
	}
}

function fillFolder(aPopup, aFolder, aDepth) {
	aFolder.containerOpen = true;
	for (var c = 0; c < aFolder.childCount; c++) {
		var child = aFolder.getChild(c);
		if (child.type == Ci.nsINavHistoryResultNode.RESULT_TYPE_FOLDER) {
			child.QueryInterface(Ci.nsINavHistoryContainerResultNode);
			var element = document.createElementNS(RsstlerUtils.XUL_NS, "menuitem");
			element.setAttribute("label", new Array(aDepth + 1).join("   ") + child.title);
			element.setAttribute("id", child.itemId);
			aPopup.appendChild(element);
			if (child.itemId == rsstlerFolderID) {
				gList.selectedItem = element;
			}
			fillFolder(aPopup, child, ++aDepth);
			--aDepth;
		}
	}
}
