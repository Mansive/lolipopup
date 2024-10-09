// ==UserScript==
// @name        lolipopup
// @namespace   Violentmonkey Scripts
// @match       *://*/*
// @grant       GM.getResourceUrl
// @grant       GM.addElement
// @grant       GM.registerMenuCommand
// @grant       GM.xmlHttpRequest
// @homepageURL https://github.com/Mansive/lolipopup
// @downloadURL https://github.com/Mansive/lolipopup/releases/latest/download/lolipopup.user.js
// @version     1.0.0
// @author      Mansive
// @description 5/14/2024
// @resource imgfallback https://raw.githubusercontent.com/Mansive/lilium-orientalis-library/main/public/placeholder.avif
// ==/UserScript==

console.log("Hello world!");

let popupWidth = 500;
let popupHeight = 400;
let popupButtonWidth = 20;
let popupButtonHeight = 20;

let cursorX = -1;
let cursorY = -1;

let queryText = "";
let imgfallback = null;

const popupHTML = `
<style>
body {
  background: aliceblue;
  margin: 0;
  font-family: "ヒラギノ角ゴ Pro W3", "Hiragino Sans", "Hiragino Kaku Gothic Pro", "メイリオ", "Meiryo", "ＭＳ Ｐゴシック", sans-serif;
}
#noResults {
  display: block;
  margin: auto;
  text-align: center;
}
.card {
  font-size: 1em;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  height: fit-content;
  gap: 0.1rem;
  padding: 0.1rem 0;
}
/* Selects every card after first one */
.card ~ .card {
  border-top: 2px solid rgb(0, 0, 0);
}
.cover {
  object-fit: contain;
  overflow: hidden;
  min-height: 85px;
  min-width: 60px;
  margin-left: 0.1rem;
  border: 1px solid #8ac7ff;
  /* Hide alt text */
  font-size: 0;
}
.bookInfo {
  display: flex;
  flex-direction: column;
  margin-right: auto;
}
.title {
  font-size: 1em;
}
.title em {
  font-style: normal;
  color: rgb(255, 64, 0);
  text-shadow: 0 0 1px rgba(190, 165, 0, 0.5);
}
.trueTitle {
  font-size: 0.8em;
  color: rgb(95, 95, 95);
  margin-top: -0.1rem;
}
.source {
  margin-top: auto;
  margin-bottom: -0.2rem;
  font-size: 0.9em
}
.fileInfo {
  display: flex;
  flex-direction: column;
  text-align: right;
  flex-shrink: 0;
  overflow: hidden;
  margin-right: 0.5rem;
  font-size: 0.8em;
}
</style>`;

const shadowCSS = new CSSStyleSheet();
shadowCSS.replaceSync(`
#lolibutton {
  cursor: pointer;
  visibility: hidden;
  position: fixed;
  z-index: 2147483647;
  top: 0px;
  left: 0px;
  width: ${popupButtonWidth}px;
  height: ${popupButtonHeight}px;
  background-color: papayawhip;
  border: 3px solid rgb(224, 168, 0);
  border-radius: 5px;
}
#lolibutton:hover {
  background-color: powderblue;
}
#lolipopup {
  visibility: hidden;
  position: fixed;
  z-index: 2147483647;
  top: 0px;
  left: 0px;
  width: ${popupWidth}px;
  height: ${popupHeight}px;
  border: 2px solid black;
  border-radius: 5px;
  box-shadow: 0 0 10px 5px #00314a24;
}
`);

const shadowHost = document.createElement("div");
shadowHost.style = "all: initial !important";
const shadow = shadowHost.attachShadow({ mode: "closed" });
shadow.adoptedStyleSheets = [shadowCSS];
document.body.appendChild(shadowHost);

let popupButton = GM.addElement(shadow, "button", {
  type: "button",
  id: "lolibutton",
});

let popupResults = GM.addElement(shadow, "iframe", {
  title: "Lolibrary search results",
  id: "lolipopup",
  srcdoc: popupHTML,
});

// https://stackoverflow.com/a/48764436
function round(num, decimalPlaces = 0) {
  var p = Math.pow(10, decimalPlaces);
  var n = num * p * (1 + Number.EPSILON);
  return Math.round(n) / p;
}

function searchTitle(title) {
  // return fetch("https://lolibrary.moe/api/search?mode=normal&query=" + title, {
  //   method: "GET",
  // }).then((response) => {
  //   return response.json();
  // });
  return new Promise((resolve, reject) => {
    GM.xmlHttpRequest({
      url: "https://lolibrary.moe/api/search?mode=normal&query=" + title,
      method: "GET",
      onload: (response) => resolve(JSON.parse(response.responseText)),
      onerror: (error) => reject(error),
    });
  });
}

// Hide popup and reset its HTML
function hidePopup() {
  popupResults.style.visibility = "hidden";
  popupResults.contentDocument.documentElement.scrollTo(0, 0);
  popupResults.contentDocument.body.innerHTML = "";
}

function hidePopupButton() {
  popupButton.style.visibility = "hidden";
}

function getSelectionText() {
  let text = "";
  if (window.getSelection) {
    text = window.getSelection().toString();
  } else if (document.selection && document.selection.type != "Control") {
    text = document.selection.createRange().text;
    console.log("Document was selected!" + document.selection);
  }
  return text;
}

function getSelectionElement() {
  if (window.getSelection().type !== "None") {
    return window.getSelection().anchorNode.parentNode;
  } else {
    console.log("You clicked on something weird");
    return null;
  }
}

function mouseMonitor(event) {
  cursorX = event.clientX;
  cursorY = event.clientY;
}

async function showPopup() {
  const resultsPromise = searchTitle(queryText);

  const loading = GM.addElement(popupResults.contentDocument.body, "span", {
    textContent: "Loading...",
  });

  // Make sure the popup is within window bounds
  const { left: currentX, top: currentY } = popupButton.getBoundingClientRect();
  const offsetX = Math.min(0, window.innerWidth - (currentX + popupWidth));
  const offsetY = Math.min(0, window.innerHeight - (currentY + popupHeight));
  const top = Math.max(0, currentY + offsetY);
  const left = Math.max(0, currentX + offsetX);

  popupResults.style.top = `${top}px`;
  popupResults.style.left = `${left}px`;

  popupResults.style.visibility = "visible";

  const matchedTitles = await resultsPromise;
  loading.style.display = "none";

  // Get through Discord's strict CSP
  // https://violentmonkey.github.io/api/gm/#gm_addelement
  if (matchedTitles.records.length === 0) {
    GM.addElement(popupResults.contentDocument.body, "span", {
      id: "noResults",
      textContent: "No results",
    });
  } else {
    for (const book of matchedTitles.records) {
      let card = GM.addElement(popupResults.contentDocument.body, "div", {
        class: "card",
      });
      GM.addElement(card, "img", {
        src: `${book.cover}`,
        class: "cover",
        alt: "Book cover",
        referrerpolicy: "no-referrer",
        width: "50px",
        loading: "lazy",
        // Fallback img broken on Discord??
        onerror: `this.onerror=null;this.src="${imgfallback}"`,
      });
      let bookInfo = GM.addElement(card, "div", { class: "bookInfo" });
      let title = GM.addElement(bookInfo, "span", {
        class: "title",
      });
      title.innerHTML = `${book.title}`;
      GM.addElement(bookInfo, "span", {
        class: "trueTitle",
        textContent: `${book.true_title}`,
      });
      GM.addElement(bookInfo, "span", {
        class: "source",
        textContent: `${book.sources}`,
      });
      let fileInfo = GM.addElement(card, "div", { class: "fileInfo" });
      GM.addElement(fileInfo, "span", {
        class: "size",
        textContent: `${round(book.size / 1048576, 2).toFixed(1)}`,
      });
      GM.addElement(fileInfo, "span", {
        class: "extension",
        textContent: `${book.extension}`,
      });
    }
  }

  // It's fine for the button to disappear now
  hidePopupButton();
}

function showPopupButton() {
  const currentX = cursorX;
  const currentY = cursorY;

  // Make sure the popup is within window bounds
  popupButton.style.top = `${
    currentY + Math.min(10, window.innerHeight - (currentY + popupButtonHeight))
  }px`;
  popupButton.style.left = `${
    currentX + Math.min(10, window.innerWidth - (currentX + popupButtonWidth))
  }px`;
  popupButton.style.visibility = "visible";
}

function selectionTextHandler() {
  // Prevent popup when Yomitan popup is focused
  if (!document.activeElement.contains(getSelectionElement())) {
    return null;
  }

  // http://www.rikai.com/library/kanjitables/kanji_codes.unicode.shtml
  const regexJP =
    /[\p{Script=Han}\p{Script=Katakana}\p{Script=Hiragana}！-～\u3000-\u303f]/gu;

  const currentText = getSelectionText();

  // Check if selected text is empty, too long, or lacks Japanese characters
  if (
    currentText.length === 0 ||
    currentText.length > 128 ||
    !currentText.match(regexJP)
  ) {
    return null;
  }

  // Lock in currently selected text
  queryText = currentText;

  showPopupButton();
}

(async function () {
  "use strict";
  let blobUrl = GM.getResourceUrl("imgfallback");
  imgfallback = await blobUrl;

  window.addEventListener(
    "load",
    () => {
      // const titleElement = document.querySelector(".p-main__title");
      // const titleElementEM = document.querySelector(".p-main__title em");
      // // bookwalker
      // if (titleElement) {
      //   const title = titleElement.textContent;
      //   let lateTitle = "";
      //   searchTitle(title).then((data) => {
      //     // console.log(data.records[0].title);
      //     data.records.forEach((element) => {
      //       let p = document.createElement("p");
      //       p.innerHTML = element.title;
      //       const styles = {
      //         background: "aquamarine",
      //         fontSize: "13px",
      //       };
      //       Object.assign(p.style, styles);
      //       document.querySelector(".p-summary__title").append(p);
      //     });
      //   });
      // }
    },
    false
  );
})();

// If mousedown on button, prevent document's mousedown from hiding button
popupButton.addEventListener(
  "mousedown",
  (event) => {
    event.stopPropagation();
  },
  true
);
popupButton.addEventListener("click", showPopup);

document.addEventListener("mousedown", () => {
  hidePopup();
  hidePopupButton();
});
document.addEventListener("mouseup", selectionTextHandler);
document.addEventListener("mousemove", mouseMonitor);
