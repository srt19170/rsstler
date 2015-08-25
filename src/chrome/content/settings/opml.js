/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is Sage.
 *
 * The Initial Developer of the Original Code is
 * Peter Andrews <petea@jhu.edu>.
 * Portions created by the Initial Developer are Copyright (C) 2005
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 * Peter Andrews <petea@jhu.edu>
 * Erik Arvidsson <erik@eae.net>
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the MPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the MPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */
Components.utils.import("resource://gre/modules/Services.jsm");

//XUL Object
var winMain, txtImportFile, txtExportFile;
var strRes;

var bookmarksService = Cc["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Ci.nsINavBookmarksService);

var g_errorMesage = "";

function initOPML() {
	strRes = document.getElementById("strRes");

	winMain = document.getElementById("winMain");
	txtImportFile = document.getElementById("txtImportFile");
	txtExportFile = document.getElementById("txtExportFile");
}

function finish() {
	return true;
}

function browseImportFile() {
	var fpicker = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
	fpicker.init(window, strRes.getString("opml_select_file"), fpicker.modeOpen);
	fpicker.appendFilter(strRes.getString("opml_opml_file") + " (*.xml, *.opml)", "*.xml;*.opml");
	fpicker.appendFilters(fpicker.filterAll);

	var showResult = fpicker.show();
	if(showResult == fpicker.returnOK) {
		// txtImportFile.value = fpicker.file.path;
		txtImportFile.nsIURI = Services.io.newFileURI(fpicker.file);
		txtImportFile.value = txtImportFile.nsIURI.path; 
	}
}

function browseExportFile() {
	var fpicker = Components.classes["@mozilla.org/filepicker;1"].createInstance(Components.interfaces.nsIFilePicker);
	fpicker.init(window, strRes.getString("opml_select_file"), fpicker.modeSave);
	fpicker.appendFilter(strRes.getString("opml_opml_file") + " (*.xml, *.opml)", "*.xml;*.opml");
	fpicker.appendFilters(fpicker.filterAll);
	fpicker.defaultString = "export.opml";

	var showResult = fpicker.show();
	if(showResult == fpicker.returnOK || showResult == fpicker.returnReplace) {
		txtExportFile.value = fpicker.file.path;
	}
}

function checkFilePath(aFilePath, aExistCheck) {
	if(!aFilePath) {
		g_errorMesage = strRes.getString("opml_path_blank");
		return false;
	}

	var tmpFile = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsIFile);
	try {
		tmpFile.initWithPath(aFilePath);
		if(aExistCheck) {
			if(!tmpFile.exists()) {
				g_errorMesage = strRes.getString("opml_path_nofile");
				return false;
			}
		}
	} catch(e) {
		g_errorMesage = strRes.getString("opml_path_invalid");
		return false;
	}

	return true;
}

//********** ********** Import OPML ********** **********

function importOPML() {
	var httpReq = new XMLHttpRequest();
	var opmlUrl = txtImportFile.nsIURI;
	
	httpReq.open("GET", opmlUrl.spec);
	httpReq.overrideMimeType("application/xml");
	httpReq.timeout = RsstlerUtils.getRsstlerPrefValue(RsstlerUtils.PREF_WAIT_FOR_RESPONSE);
	httpReq.addEventListener("load", importContinue, false);
	httpReq.addEventListener("error", importError, false);
	httpReq.addEventListener("timeout", importError, false);

	try {
		httpReq.setRequestHeader("User-Agent", RsstlerUtils.USER_AGENT);
		httpReq.send();
	} catch(e) {
		// FAILURE
		RsstlerLogger.warn("Error sending http request: "+e);
	};
}

function importError(e) {
	alert("Error importing OPML.");
}

function importContinue(e) {
	RsstlerLogger.info("e.target = "+e.target);
	var httpReq = e.target;
	

	var opmlDoc = httpReq.responseXML;
	if(opmlDoc.documentElement.localName != "opml") {
		reportError(strRes.getString("opml_import_badfile"));
		rsstlerUI.notifyObservers("rsstlerDone", name);
		return false;
	}
	var rssReaderFolderID = RsstlerUtils.getRsstlerRootFolderId();
	var rootFolderId = rssReaderFolderID;

	var treeWalker = opmlDoc.createTreeWalker(opmlDoc, NodeFilter.SHOW_ELEMENT, outlineFilter, true);

	function isFolder(node) {
		return !(node.hasAttribute('xmlUrl') || node.hasAttribute('xmlurl'));
	}

	alert("Import may be lengthy for big OPML files.  Don't cancel script if you get a warning!");
	var bmsvc = Components.classes["@mozilla.org/browser/nav-bookmarks-service;1"].getService(Components.interfaces.nsINavBookmarksService);
	var batchFn = { runBatched: function (aUserData) {
		try {
			while (treeWalker.nextNode()) {
				var cNode = treeWalker.currentNode;
				var pNode = cNode.parentNode;
				var parentFolderId = ("_folderId" in pNode) ? pNode._folderId : rootFolderId;
				if (isFolder(cNode)) {
					var title = cNode.getAttribute("title");
					if (!title) title = cNode.getAttribute("text");
					if (!title) title = "folder";
					cNode._folderId = bookmarksService.createFolder(parentFolderId, title, bookmarksService.DEFAULT_INDEX);
				} else {
					createRssItem(cNode, parentFolderId);
				}
			}
		} catch (e) {

		};
	}
	};
	bmsvc.runInBatchMode(batchFn, null); 
	alert("Import Succeeded!");
	rsstlerUI.notifyObservers("rsstlerDone", name);
	return true;
}

function outlineFilter(aNode) {
	if(aNode.localName == "outline") {
		return NodeFilter.FILTER_ACCEPT;
	} else {
		return NodeFilter.FILTER_SKIP;
	}
}

function createRssItem(aOutlineNode, aRssFolderId) {
	var type = aOutlineNode.getAttribute("type");
	var title = aOutlineNode.getAttribute("title");
	if(!title) title = aOutlineNode.getAttribute("text");
	if(aOutlineNode.hasAttribute("xmlUrl")) {
		var xmlUrl = aOutlineNode.getAttribute("xmlUrl");
	} else {
		var xmlUrl = aOutlineNode.getAttribute("xmlurl");
	}

	if(type!="rss" && !title && xmlUrl) return;

	var uri = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService).newURI(xmlUrl, null, null);
	bookmarksService.insertBookmark(aRssFolderId, uri, -1, title);
}

//********** ********** Export OPML ********** **********

function exportOPML() {
	var path = txtExportFile.value;
	if (!checkFilePath(path, false)) {
		reportError(g_errorMesage);
		return false;
	}

	var opmlSource = createOpmlSource();
	opmlSource = RsstlerUtils.convertCharCodeFrom(opmlSource, "UTF-8");

	var tmpFile = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsIFile);
	try {
		tmpFile.initWithPath(path);
		if(tmpFile.exists()) {
			tmpFile.remove(true);
		}
		tmpFile.create(tmpFile.NORMAL_FILE_TYPE, 0666);
		var stream = Components.classes['@mozilla.org/network/file-output-stream;1'].createInstance(Components.interfaces.nsIFileOutputStream);
		stream.init(tmpFile, 2, 0x200, false); // open as "write only"
		stream.write(opmlSource, opmlSource.length);
		stream.flush();
		stream.close();
	} catch(e) {
		reportError(strRes.getString("opml_export_nocreate"));
		return false;
	}

	alert("Export Succeeded!");
	return true;
}

function createOpmlSource() {
	var hist = Components.classes["@mozilla.org/browser/nav-history-service;1"]
	.getService(Components.interfaces.nsINavHistoryService);

	var rssReaderFolderID = RsstlerUtils.getRsstlerRootFolderId();

	var srcTemplate =  '<?xml version="1.0" encoding="UTF-8"?>';
	srcTemplate += '<opml version="1.0">';
	srcTemplate += '<head><title>Rsstler OPML Export</title></head>';
	srcTemplate += '<body/></opml>';

	var opmlDoc = new DOMParser().parseFromString(srcTemplate, "text/xml");
	var opmlBody = opmlDoc.getElementsByTagName("body")[0];

	var root = RsstlerUtils.getNodeFromItemId(rssReaderFolderID);

	opmlBody.appendChild(createOpmlOutline(opmlDoc, root));
	xmlIndent(opmlDoc);

	var opmlSource = new XMLSerializer().serializeToString(opmlDoc);
	return opmlSource;
}

function createOpmlOutline(aOpmlDoc, aResultNode) {
	var bmsvc = Components.classes["@mozilla.org/browser/nav-bookmarks-service;1"]
	.getService(Components.interfaces.nsINavBookmarksService);

	var type = bmsvc.getItemType(aResultNode.itemId);
	var title = bmsvc.getItemTitle(aResultNode.itemId);

	var outlineNode = aOpmlDoc.createElement("outline");

	var childNode, childNodeType;
	if (type == bmsvc.TYPE_FOLDER) {
		outlineNode.setAttribute("text", title);

		aResultNode.QueryInterface(Components.interfaces.nsINavHistoryContainerResultNode);
		aResultNode.containerOpen = true;
		for (var i = 0; i < aResultNode.childCount; i ++) {
			childNode = aResultNode.getChild(i);
			childNodeType = bmsvc.getItemType(childNode.itemId);
			if (childNodeType == bmsvc.TYPE_FOLDER || childNodeType == bmsvc.TYPE_BOOKMARK) {
				outlineNode.appendChild(createOpmlOutline(aOpmlDoc, childNode));        
			}
		}
		aResultNode.containerOpen = false;
	} else if (type == bmsvc.TYPE_BOOKMARK) {
		var url = bmsvc.getBookmarkURI(aResultNode.itemId).spec;
		outlineNode.setAttribute("type", "rss");
		outlineNode.setAttribute("text", title);
		outlineNode.setAttribute("title", title);
		outlineNode.setAttribute("xmlUrl", url);
	} 
	return outlineNode;
}

function xmlIndent(aDoc) {
	var treeWalker = aDoc.createTreeWalker(aDoc, NodeFilter.SHOW_ELEMENT, null, true);
	aDoc._depth = 0;
	while(treeWalker.nextNode()) {
		var cNode = treeWalker.currentNode;
		var pNode = cNode.parentNode;
		var tmpTextNode;

		if(pNode) {
			cNode._depth = pNode._depth + 1;
			if(cNode == aDoc.documentElement) continue;
			tmpTextNode = aDoc.createTextNode("\n" + getIndent(cNode._depth));
			pNode.insertBefore(tmpTextNode, cNode);
		}
		if(!cNode.nextSibling) {
			tmpTextNode = aDoc.createTextNode("\n" + getIndent(cNode._depth - 1));
			pNode.appendChild(tmpTextNode);
		}
	}
	function getIndent(aDepth) {
		// in some weird case this is NaN
		if (aDepth < 0 || isNaN(aDepth))
			return "";
		var result = new Array( aDepth );
		return result.join("\t");
	}
}

function reportError(s)
{
	// This should really show an error prompt
	alert(s);
}

