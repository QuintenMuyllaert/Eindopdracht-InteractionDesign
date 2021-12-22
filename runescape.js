const delay = async (time) => {
  return new Promise((resolve) => setTimeout(resolve, time));
};

const loadJSON = async (url) => {
  const resp = await fetch(url.replace(/\+/g, "%2B"));
  return await resp.json();
};

const loadDescriptionOfItem = async (item) => {
  const json = await loadJSON(
    `https://runescape.wiki/api.php?format=json&action=query&prop=extracts&exintro&explaintext&redirects=1&titles=${item.replace(
      / /g,
      "_"
    )}`
  );
  const key = Object.keys(json.query.pages)[0];
  return json.query.pages[key].extract;
};

const keyExists = (key = "", obj = {}) => {
  return (
    Object.keys(obj).find((k) => k.toLowerCase() === key.toLowerCase()) || false
  );
};

const getAllPartialKeys = (key = "", obj = {}) => {
  let items = [];
  for (let k in obj) {
    k.toLowerCase().includes(key.toLowerCase()) ? items.push(k) : null;
  }
  return items.sort();
};

const getAllPartialKeysLazy = (searchQuerry = "", obj = {}) => {
  let splitQuerry = searchQuerry.split(" ");
  let keys = Object.keys(obj);
  for (let subQuerry of splitQuerry) {
    let list = getAllPartialKeys(subQuerry, obj);
    keys = keys.filter((value) => list.includes(value));
  }
  return keys.sort();
};

const lazyGrab = (items) => {
  let termsList = {};
  for (let item of Object.keys(items)) {
    let terms = item.toLowerCase().split(" ");
    for (let term of terms) {
      // gets rid of "+", "(1)", "(2)", "(3)",...
      if (term.length > 3) {
        if (termsList[term]) {
          termsList[term] += 1;
        } else {
          termsList[term] = 1;
        }
      }
    }
  }
  let arrayized = [];
  Object.keys(termsList).forEach((key) => {
    arrayized.push([key, termsList[key]]);
  });
  arrayized = arrayized.sort((a, b) => {
    return b[1] - a[1];
  });
  return arrayized;
};

const prettyPrintDate = (d, time = false) => {
  return (
    ("0" + d.getDate()).slice(-2) +
    "-" +
    ("0" + (d.getMonth() + 1)).slice(-2) +
    "-" +
    d.getFullYear()
  );
  //not needed but might aswell keep
  time =
    ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2);
};

const prettyPrintNumber = (x) => {
  return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const generateGraphArrays = async (item) => {
  const priceData = await loadJSON(
    `https://api.weirdgloop.org/exchange/history/rs?name=${item.replace(
      / /g,
      "_"
    )}`
  );
  const key = Object.keys(priceData)[0]; // {"Air rune":[ a, b, c]} //why..
  let labels = [];
  let values = [];
  for (const dataPoint of priceData[key]) {
    values.push(dataPoint.price);
    labels.push(prettyPrintDate(new Date(dataPoint.timestamp)));
  }

  return {
    labels: labels,
    data: values,
  };
};

const createElement = (str) => {
  let frag = document.createDocumentFragment();
  let elem = document.createElement("div");
  elem.innerHTML = str;

  while (elem.childNodes[0]) {
    frag.appendChild(elem.childNodes[0]);
  }
  return frag;
};

const getFromLocalStorage = (name, defaultValue) => {
  let ret;
  try {
    ret = JSON.parse(localStorage.getItem(name));
    if (ret == null || ret == "null") {
      ret = defaultValue;
    }
  } catch (err) {
    ret = defaultValue;
  }
  return ret;
};

const setInLocalStorage = (name, value) => {
  localStorage.setItem(name, JSON.stringify(value));
};

let items;
let selectedItem;
let selectedItemCard;
let allitems = {};

let favorites = getFromLocalStorage("favorites", {});

let mostCommon;
let priceCache = {};

let lookingAtFavorites = getFromLocalStorage("lookingAtFavorites", false);

let interruptDownload = false;
let downloading = 0;
async function downloadItems(items) {
  if (interruptDownload) {
    return;
  }

  let first100 = [];
  for (item of items) {
    if (!priceCache[item] && item != "false") {
      first100.push(item);
    }
  }
  first100 = first100.splice(0, 100);

  if (first100.length > 0) {
    console.log(`downloading ${first100.length} items...`);
    console.log(first100);
    for (const item of first100) {
      priceCache[item] = "placeholder";
    }
    downloading++;
    priceCache = {
      ...priceCache,
      ...(await loadJSON(
        `https://api.weirdgloop.org/exchange/history/rs/latest?name=${first100.join(
          "|"
        )}`
      )),
    };
    downloading--;
    return await downloadItems(items);
  }
}

let latestGraphData = {};
let selectedRadio = null;

const updateGraph = (days) => {
  const data = JSON.parse(JSON.stringify(latestGraphData));
  const getLast = (arr, days) => {
    return arr.slice(Math.max(arr.length - days, 0));
  };

  data.labels = getLast(data.labels, days);
  data.data = getLast(data.data, days);

  myChart.config.data.labels = data.labels;
  myChart.config.data.datasets[0].data = data.data;
  myChart.config.data.datasets[0].label = selectedItem;

  myChart.update();
  //console.log(priceCache[item]);
  //console.log(days, data.labels.length);
};

async function changeItemContent(name) {
  let html = document.querySelector(".js-items");

  if (lookingAtFavorites) {
    items = favorites;
  } else {
    items = allItems;
  }

  let rune = getAllPartialKeysLazy(name, items).sort();

  if (lookingAtFavorites) {
    if (!rune.length && !name) {
      rune = Object.keys(favorites);
    }
    console.log(!rune.length);
    if (!rune.length) {
      html.innerHTML = `
      <div class="notificationbox">
        <h1 class="flex-center-vertical">No items found</h1>
        <h2 class="flex-center-vertical">Only favorited items shown!</h2>
      </div>`;
      return;
    }
  } else if (name == "" || name == null || !rune.length) {
    interruptDownload = true;

    let uRNG = (amt, max) => {
      if (max < amt) {
        console.error("Not possible (suggestions > items)");
        return;
      }
      let ret = [];
      while (ret.length < amt) {
        let rng = Math.round(Math.random() * max);
        if (!ret.includes(rng)) {
          ret.push(rng);
        }
      }
      return ret;
    };

    let nu = uRNG(3, 100);
    html.innerHTML = `
    <div class="notificationbox">
      <h1 class="flex-center-vertical">No items found</h1>
      <h2 class="flex-center-vertical">Try "${mostCommon[nu[0]][0]}", "${
      mostCommon[nu[1]][0]
    }", "${mostCommon[nu[2]][0]}"</h2>
    </div>`;
    return;
  }

  html.classList.add("itemcard--skeleton");
  html.innerHTML = "";
  //
  interruptDownload = true;
  while (downloading) {
    await delay(100);
  }
  interruptDownload = false;

  await downloadItems(rune);
  if (interruptDownload) {
    return;
  }

  let i = 0;
  for (let item of rune) {
    let card = createElement(`
      <button id="itemcard-${i}" class="itemcard-${item} itemcard--container">
        <div class="itemcard--horizontal-container">
          <div class="itemcard--flex-center-vertical">
          <div class="itemcard--div-square itemcard--flex-center-horizontal">
            <img src="./icons/${item.replace(/\//g, "-")}.png" alt="${item}">
          </div>
          </div>
          <div>
            <h2 class="itemcard--item-name">${item}</h2>
            <p class="itemcard--item-price">${
              Object.keys(favorites).includes(item) ? "★ " : ""
            }${prettyPrintNumber(priceCache?.[item]?.price || "N/A")}gp</p>
          </div>
        </div>
      </button>
    `);
    if (interruptDownload) {
      return;
    }
    html.appendChild(card);
    //without delay the browser gets really really laggy because the amount of DOM updates.
    await delay(5);
    document
      .getElementById("itemcard-" + i)
      .addEventListener("click", async function () {
        console.log(item);
        selectedItem = item;
        selectedItemCard = this;
        this.classList.add("itemcard--grow");
        document.querySelector(".itemdetail--container").isUp = true;
        document
          .querySelector(".itemdetail--container")
          .classList.add("itemdetail--show");
        document
          .querySelector(".itemdetail--container")
          .classList.remove("itemdetail--hide");
        document.querySelector("body").classList.add("disable-scroll");

        document.querySelector(
          ".itemdetail--item-image"
        ).src = `./fullres/${item}.png`;
        document.querySelector(".itemdetail--item-name h1").innerText = item;
        document.querySelector(
          ".itemdetail--item-icon"
        ).src = `./fullres/${item}.png`;
        document.querySelector(".itemdetail--item-description-text").innerText =
          await loadDescriptionOfItem(item);

        Object.keys(favorites).includes(item)
          ? document
              .querySelector("#favorite-detail")
              .classList.add("itemdetail--favorited")
          : document
              .querySelector("#favorite-detail")
              .classList.remove("itemdetail--favorited");

        latestGraphData = await generateGraphArrays(item);
        updateGraph(selectedRadio || 60);
      });
    i++;
  }
  html.classList.remove("itemcard--skeleton");
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log("loaded");
  allItems = await loadJSON("./staticItems.json");
  items = allItems;
  let changecontentTimeout;
  let html = document.querySelector(".js-items");

  mostCommon = lazyGrab(allItems);

  changeItemContent(document.querySelector("#searchbar").value);

  //lazyload items with skeletonloading while typing in search.
  document.querySelector("#searchbar").addEventListener("input", function () {
    console.log("input", this.value);
    html.classList.add("itemcard--skeleton");
    clearTimeout(changecontentTimeout);
    changecontentTimeout = setTimeout(() => {
      changeItemContent(this.value);
    }, 500);
  });

  //disable scroll when itemdetail is shown
  document
    .querySelector(".itemdetail--container")
    .addEventListener("click", function (e) {
      if (e.target != this) {
        return;
      }
      this.classList.remove("itemdetail--show");
      this.classList.add("itemdetail--hide");
      document.querySelector("body").classList.remove("disable-scroll");
    });

  //close button inside of itemdetail
  document
    .querySelector(".itemdetail--close-button")
    .addEventListener("click", function () {
      document.querySelector(".itemdetail--container").isUp = false;
      document
        .querySelector(".itemdetail--container")
        .classList.remove("itemdetail--show");
      document
        .querySelector(".itemdetail--container")
        .classList.add("itemdetail--hide");
      document.querySelector("body").classList.remove("disable-scroll");
    });

  //favorite detail button
  document
    .querySelector("#favorite-detail")
    .addEventListener("click", function () {
      if (Object.keys(favorites).includes(selectedItem)) {
        delete favorites[selectedItem];
        this.classList.remove("itemdetail--favorited");
        selectedItemCard.querySelector(".itemcard--item-price").textContent =
          selectedItemCard
            .querySelector(".itemcard--item-price")
            .textContent.replace("★ ", "");
      } else {
        favorites[selectedItem] = allItems[selectedItem];
        this.classList.add("itemdetail--favorited");

        selectedItemCard.querySelector(".itemcard--item-price").textContent =
          "★ " +
          selectedItemCard.querySelector(".itemcard--item-price").textContent;
      }

      if (lookingAtFavorites) {
        changeItemContent(document.querySelector("#searchbar").value);
      }

      setInLocalStorage("favorites", favorites);
    });

  //favorite main button
  document
    .querySelector("#favorite-main")
    .addEventListener("click", function () {
      lookingAtFavorites = !lookingAtFavorites;
      setInLocalStorage("lookingAtFavorites", lookingAtFavorites);
      lookingAtFavorites
        ? this.classList.add("itemdetail--favorited")
        : this.classList.remove("itemdetail--favorited");

      changeItemContent(document.querySelector("#searchbar").value);
    });

  //apply class on load
  document
    .querySelector("#favorite-main")
    .classList[lookingAtFavorites ? "add" : "remove"]("itemdetail--favorited");

  //escape button inside of itemdetail
  document.addEventListener("keydown", function (event) {
    if (
      event.key == "Escape" &&
      document.querySelector(".itemdetail--container").isUp
    ) {
      document
        .querySelector(".itemdetail--container")
        .classList.remove("itemdetail--show");
      document
        .querySelector(".itemdetail--container")
        .classList.add("itemdetail--hide");
      document.querySelector("body").classList.remove("disable-scroll");
    }
  });

  //radio button inside of itemdetail
  document.querySelectorAll(".roundbutton--input-element").forEach((e) =>
    e.addEventListener("change", () => {
      //console.log(e.id);
      const states = [30, 60, 90, "all"];
      for (const state of states) {
        if (e.id.includes(state)) {
          const days = state == "all" ? Infinity : state;
          selectedRadio = days;
          updateGraph(days);
          break;
        }
      }
    })
  );
});
