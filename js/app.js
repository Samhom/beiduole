(function () {
  const calc = window.BEIDUOLE;
  const KEY = "beiduole.v1";
  const VIEWS = ["close", "menu", "week", "offer"];
  const app = document.getElementById("app");
  const navButtons = document.querySelectorAll("nav [data-view]");
  let state = load();

  document.querySelector("nav").addEventListener("click", function (event) {
    const button = event.target.closest("[data-view]");
    if (!button) return;
    location.hash = button.dataset.view;
  });
  window.addEventListener("hashchange", render);
  render();

  function render() {
    const view = currentView();
    navButtons.forEach(function (button) {
      if (button.dataset.view === view) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    const shop = document.getElementById("shop-label");
    shop.textContent = state.dishes.length ? state.shopName : "打烊算损耗";
    app.replaceChildren();
    const screen = view === "menu" ? renderMenu() : view === "week" ? renderWeek() : view === "offer" ? renderOffer() : renderClose();
    app.append(screen);
    document.title = { close: "打烊", menu: "菜品", week: "本周", offer: "报价" }[view] + " · 备多了";
  }

  function renderClose() {
    const wrap = h("section", {});
    if (state.sample) wrap.append(sampleBanner());
    if (!state.dishes.length) {
      wrap.append(
        h("p", { class: "kicker" }, "给餐饮小店的打烊账"),
        h("h1", {}, "先看今天倒掉了多少钱"),
        h("p", { class: "lede" }, "备多了按每份成本，把多备的份数算成钱，并指出明天少备哪一道最划算。店主付钱，是因为这笔钱本来就是他的成本。"),
        h("div", { class: "actions" }, [
          h("button", { class: "btn tag", type: "button", onclick: loadSample }, "看一家面馆的账"),
          h("button", { class: "btn-ghost", type: "button", onclick: function () { location.hash = "menu"; } }, "记下我的菜"),
        ])
      );
      return wrap;
    }
    const draft = todayLines();
    const total = calc.dayTotal(draft);
    const top = draft.slice().sort(function (a, b) { return calc.lineLoss(b) - calc.lineLoss(a); })[0];
    wrap.append(
      h("div", { class: "hero" }, [
        h("p", { class: "kicker" }, formatDate(todayISO()) + " · 今日倒掉"),
        h("p", { class: total > 0 ? "yuan loss" : "yuan ok", id: "hero-num" }, [formatYuan(total), h("small", {}, "元")]),
        h("p", { class: "sub", id: "hero-sub" }, heroSub(total, top)),
      ])
    );
    const list = h("div", { class: "lines card" });
    draft.forEach(function (line) { list.append(lineRow(line)); });
    wrap.append(list, adviceCard());
    return wrap;
  }

  function lineRow(line) {
    const loss = calc.lineLoss(line);
    const prepped = h("input", { type: "text", inputmode: "numeric", "aria-label": line.name + "备了多少份", value: String(line.prepped) });
    const wasted = h("input", { type: "text", inputmode: "numeric", "aria-label": line.name + "倒掉多少份", value: String(line.wasted) });
    const lossNode = h("div", { class: loss > 0 ? "row-loss hot money" : "row-loss money", "data-dish": line.dishId }, formatYuan(loss) + " 元");
    prepped.addEventListener("input", function () { applyCount(line.dishId, "prepped", prepped.value); });
    wasted.addEventListener("input", function () { applyCount(line.dishId, "wasted", wasted.value); });
    prepped.addEventListener("change", commitCounts);
    wasted.addEventListener("change", commitCounts);
    return h("article", { class: "line" }, [
      h("div", { class: "who" }, [h("h3", {}, line.name), h("p", { class: "cost" }, "每份 " + formatYuan(line.cost) + " 元")]),
      stepper("备了", prepped, function (delta) { bump(line.dishId, "prepped", delta); }, line.prepped <= 0, line.prepped >= 999),
      stepper("倒掉", wasted, function (delta) { bump(line.dishId, "wasted", delta); }, line.wasted <= 0, line.wasted >= line.prepped),
      lossNode,
    ]);
  }

  function stepper(label, input, onStep, minusDisabled, plusDisabled) {
    return h("div", {}, [
      h("span", { class: "field-label" }, label),
      h("div", { class: "step" }, [
        h("button", { type: "button", disabled: minusDisabled, onclick: function () { onStep(-1); }, "aria-label": label + "减一份" }, "−"),
        input,
        h("button", { type: "button", disabled: plusDisabled, onclick: function () { onStep(1); }, "aria-label": label + "加一份" }, "+"),
      ]),
    ]);
  }

  function adviceCard() {
    const rec = calc.recommend(state.dishes, state.days);
    const recorded = state.days.filter(dayHasPrep).length;
    if (!rec) {
      const text = recorded < 2 ? "再记下有备货的一天。只看一天，分不清是菜没人要，还是今天人少。" : "这几天没有哪一道值得少备。损耗按金额算，比例高但很便宜的菜先放着。";
      return h("aside", { class: "card advice", id: "advice" }, [h("h2", {}, "明天先不动"), h("p", {}, text)]);
    }
    const caution = rec.cautious
      ? "大约每天少倒 " + formatYuan(rec.savedPerDay) + " 元。没有一步砍到平均销量，先少这一截，卖得动再降。"
      : "若接下来的销量接近这几天的平均，大约每天少倒 " + formatYuan(rec.savedPerDay) + " 元。先试一天。";
    return h("aside", { class: "card advice", id: "advice" }, [
      h("p", { class: "kicker" }, "明天只改这一道"),
      h("strong", {}, rec.name + "先备 " + rec.suggest + " 份"),
      h("p", {}, "近几天平均卖掉 " + trimNum(rec.avgSold) + " 份，平均备了 " + trimNum(rec.avgPrepped) + " 份。比例更高的便宜菜先放着。" + caution),
    ]);
  }

  function renderMenu() {
    const wrap = h("section", {}, [
      h("p", { class: "kicker" }, "成本"),
      h("h1", {}, "只记会剩的菜"),
      h("p", { class: "lede" }, "每份成本按你实际花的食材和包装算，人工可以先不摊。先记最常倒掉的，不必搬进整张菜单。"),
    ]);
    if (state.sample) wrap.append(sampleBanner());
    const shop = h("input", { class: "text", type: "text", maxlength: "24", value: state.shopName, "aria-label": "店名" });
    shop.addEventListener("input", function () {
      state.shopName = shop.value.slice(0, 24).trim() || "我的店";
      save();
      document.getElementById("shop-label").textContent = state.dishes.length ? state.shopName : "打烊算损耗";
    });
    wrap.append(h("label", { class: "shop card" }, ["店名", shop]));
    state.dishes.forEach(function (dish) {
      const name = h("input", { class: "text", type: "text", maxlength: "24", value: dish.name, "aria-label": "菜名" });
      const cost = h("input", { class: "num", type: "text", inputmode: "decimal", value: String(dish.cost), "aria-label": dish.name + "每份成本" });
      name.addEventListener("change", function () {
        dish.name = name.value.trim().slice(0, 24) || dish.name;
        touchToday(dish);
        save();
        render();
      });
      cost.addEventListener("change", function () {
        dish.cost = calc.clampCost(cost.value);
        touchToday(dish);
        save();
        render();
      });
      wrap.append(h("div", { class: "menu-row" }, [
        name,
        cost,
        h("span", {}, "元/份"),
        h("button", { class: "btn-quiet", type: "button", onclick: function () { removeDish(dish.id); } }, "移除"),
      ]));
    });
    const addName = h("input", { class: "text", type: "text", maxlength: "24", placeholder: "例如：牛肉面", "aria-label": "新菜名" });
    const addCost = h("input", { class: "num", type: "text", inputmode: "decimal", placeholder: "8", "aria-label": "新菜每份成本" });
    wrap.append(
      h("div", { class: "add-row" }, [
        addName,
        addCost,
        h("button", { class: "btn", type: "button", onclick: function () { addDish(addName.value, addCost.value); } }, "加上"),
      ]),
      h("p", { class: "note" }, state.dishes.length >= 30 ? "三十道够用了。把不剩的先拿掉。" : "改成本只影响今天和以后。已经记下的日子仍按当时的成本。")
    );
    return wrap;
  }

  function renderWeek() {
    const recorded = state.days.filter(dayHasPrep).slice().sort(function (a, b) {
      return a.date < b.date ? 1 : -1;
    });
    const summary = calc.projection(recorded);
    const ranked = calc.rank(recorded);
    const max = recorded.reduce(function (peak, day) { return Math.max(peak, calc.dayTotal(day.lines)); }, 0);
    const bars = h("div", { class: "bars" });
    recorded.slice().reverse().forEach(function (day) {
      const total = calc.dayTotal(day.lines);
      const width = total > 0 && max > 0 ? Math.max(4, Math.round(total / max * 100)) : 0;
      bars.append(h("div", { class: "bar-row" }, [
        h("span", {}, day.date.slice(5)),
        h("div", { class: "track" }, h("i", { style: "width:" + width + "%" })),
        h("em", {}, formatYuan(total)),
      ]));
    });
    const list = h("ol", { class: "rank" });
    ranked.forEach(function (item, index) {
      list.append(h("li", {}, [h("span", {}, String(index + 1)), h("span", {}, item.name + " · 倒掉 " + item.wasted + " 份"), h("b", {}, formatYuan(item.loss) + " 元")]));
    });
    const wrap = h("section", {}, [
      h("p", { class: "kicker" }, "已记下的日子"),
      h("h1", {}, summary ? "日均倒掉 " + formatYuan(summary.avg) + " 元" : "还没有打烊账"),
      h("p", { class: "lede" }, summary ? "30 天若按这个日均，大约 " + formatYuan(summary.month) + " 元。这是已记录日均乘以 30，不是保证。" : "打烊页填上备了多少、倒掉多少，这里才会出现金额。"),
    ]);
    if (state.sample) wrap.append(sampleBanner());
    if (recorded.length) wrap.append(h("div", { class: "card" }, bars), h("h2", {}, "按倒掉的金额排"), list);
    wrap.append(h("div", { class: "actions" }, [
      h("button", { class: "btn-ghost", type: "button", onclick: exportBook }, "导出 JSON"),
    ]));
    return wrap;
  }

  function renderOffer() {
    const recorded = state.days.filter(dayHasPrep);
    const summary = calc.projection(recorded);
    const rec = calc.recommend(state.dishes, recorded);
    const sentence = calc.pitch(state.shopName, summary, rec) || "先看一家面馆的账，或记下自己的菜。有了天数和金额，这里会生成能直接说给店主听的一句。";
    const cover = summary && summary.month > 0 ? "按现在的日均，少倒掉大约 " + trimNum(calc.round2(calc.PRICE / summary.month * 100)) + "% 就覆盖月费。" : "有了日均损耗，才能把月费和倒掉的钱放在一起比。";
    const quote = h("p", { class: "quote", id: "pitch" }, sentence);
    const wrap = h("section", {}, [
      h("p", { class: "kicker" }, "单店"),
      h("div", { class: "price" }, [
        h("h1", {}, "店主按月付钱"),
        h("strong", {}, [String(calc.PRICE), h("small", {}, "元/月")]),
      ]),
      h("p", { class: "lede" }, "收费对象是每天打烊的餐饮店。损耗本来就在他的成本里，算清以后少备一道，软件费就回来了。"),
      h("div", { class: "card" }, [quote, h("p", { class: "sub" }, cover), h("div", { class: "actions" }, [
        h("button", { class: "btn tag", type: "button", id: "copy", onclick: function () { copyPitch(sentence); } }, "复制这句话"),
      ])]),
      h("div", { class: "card" }, [
        h("h2", {}, "钱怎么变大"),
        h("p", {}, "现在的收入是单店月费。一家店愿意每天打开，才去收第二家。店多了以后，更贵的那笔钱来自「哪道菜实际卖得掉」：连锁用来改备货，供货商用来少送卖不动的货。"),
        h("p", { class: "note" }, "这一版先在浏览器里把账算准。还没有收款。199 元是拿去跟店主的损耗比的定价，不是已成交的订单。"),
      ]),
    ]);
    if (!state.dishes.length) {
      wrap.append(h("div", { class: "actions" }, h("button", { class: "btn", type: "button", onclick: loadSample }, "先看面馆的数")));
    }
    return wrap;
  }

  function sampleBanner() {
    return h("div", { class: "banner" }, [
      h("span", {}, "示例：老陈面馆，还没开始少备。"),
      h("button", { class: "btn-quiet", type: "button", onclick: resetBook }, "清空，改记自己的店"),
    ]);
  }

  function todayLines() {
    const saved = state.days.find(function (day) { return day.date === todayISO(); });
    return state.dishes.map(function (dish) {
      const found = saved && saved.lines.find(function (line) { return line.dishId === dish.id; });
      return {
        dishId: dish.id,
        name: dish.name,
        cost: dish.cost,
        prepped: found ? found.prepped : 0,
        wasted: found ? Math.min(found.wasted, found.prepped) : 0,
      };
    });
  }

  function writeToday(lines) {
    const date = todayISO();
    const entry = {
      date: date,
      lines: lines.map(function (line) {
        const prepped = calc.clampCount(line.prepped);
        return {
          dishId: line.dishId,
          name: line.name,
          cost: calc.clampCost(line.cost),
          prepped: prepped,
          wasted: Math.min(calc.clampCount(line.wasted), prepped),
        };
      }),
    };
    state.days = state.days.filter(function (day) { return day.date !== date; });
    if (entry.lines.some(function (line) { return line.prepped > 0; })) state.days.push(entry);
    save();
  }

  function applyCount(dishId, key, raw) {
    const lines = todayLines();
    const line = lines.find(function (item) { return item.dishId === dishId; });
    line[key] = calc.clampCount(raw);
    if (line.wasted > line.prepped) line.wasted = line.prepped;
    writeToday(lines);
    const total = calc.dayTotal(lines);
    const hero = document.getElementById("hero-num");
    if (!hero) return;
    hero.className = total > 0 ? "yuan loss" : "yuan ok";
    hero.replaceChildren(document.createTextNode(formatYuan(total)), h("small", {}, "元"));
    const top = lines.slice().sort(function (a, b) { return calc.lineLoss(b) - calc.lineLoss(a); })[0];
    document.getElementById("hero-sub").textContent = heroSub(total, top);
    const row = document.querySelector('[data-dish="' + cssEscape(dishId) + '"]');
    if (row) {
      const loss = calc.lineLoss(line);
      row.textContent = formatYuan(loss) + " 元";
      row.className = loss > 0 ? "row-loss hot money" : "row-loss money";
    }
  }

  function commitCounts() {
    render();
  }

  function bump(dishId, key, delta) {
    const lines = todayLines();
    const line = lines.find(function (item) { return item.dishId === dishId; });
    const next = calc.clampCount(line[key]) + delta;
    if (key === "wasted") line.wasted = Math.min(Math.max(0, next), line.prepped);
    else {
      line.prepped = Math.max(0, next);
      if (line.wasted > line.prepped) line.wasted = line.prepped;
    }
    writeToday(lines);
    render();
  }

  function addDish(name, cost) {
    const title = name.trim().slice(0, 24);
    if (!title || state.dishes.length >= 30) return;
    state.dishes.push({ id: uid(), name: title, cost: calc.clampCost(cost) });
    save();
    render();
  }

  function removeDish(id) {
    state.dishes = state.dishes.filter(function (dish) { return dish.id !== id; });
    const today = state.days.find(function (day) { return day.date === todayISO(); });
    if (today) today.lines = today.lines.filter(function (line) { return line.dishId !== id; });
    save();
    render();
  }

  function touchToday(dish) {
    const today = state.days.find(function (day) { return day.date === todayISO(); });
    if (!today) return;
    const line = today.lines.find(function (item) { return item.dishId === dish.id; });
    if (!line) return;
    line.name = dish.name;
    line.cost = dish.cost;
  }

  function loadSample() {
    const beef = uid();
    const egg = uid();
    const cucumber = uid();
    state = {
      version: 1,
      sample: true,
      shopName: "老陈面馆",
      dishes: [
        { id: beef, name: "牛肉面", cost: 8 },
        { id: egg, name: "卤蛋", cost: 1.5 },
        { id: cucumber, name: "拍黄瓜", cost: 2 },
      ],
      days: [],
    };
    for (let offset = -5; offset <= 0; offset += 1) {
      const date = shiftISO(offset);
      const extra = offset === 0 ? 0 : (offset + 6) % 3;
      state.days.push({
        date: date,
        lines: [
          { dishId: beef, name: "牛肉面", cost: 8, prepped: 20, wasted: 6 },
          { dishId: egg, name: "卤蛋", cost: 1.5, prepped: 40, wasted: 16 },
          { dishId: cucumber, name: "拍黄瓜", cost: 2, prepped: 12, wasted: extra === 0 ? 1 : 0 },
        ],
      });
    }
    save();
    location.hash = "close";
    render();
  }

  function resetBook() {
    state = blank();
    save();
    location.hash = "close";
    render();
  }

  function exportBook() {
    const blob = new Blob([JSON.stringify({ shopName: state.shopName, dishes: state.dishes, days: state.days }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = h("a", { href: url, download: "beiduole-" + todayISO() + ".json" });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function copyPitch(sentence) {
    const button = document.getElementById("copy");
    const done = function () { button.textContent = "已复制"; };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(sentence).then(done).catch(function () { button.textContent = "请手动选择这句话"; });
    } else button.textContent = "请手动选择这句话";
  }

  function heroSub(total, top) {
    if (!total) return "倒掉填 0 也可以。没有损耗，今天就不用改备货。";
    return top.name + "占了 " + formatYuan(calc.lineLoss(top)) + " 元。先看金额，不看哪道菜的比例更吓人。";
  }

  function dayHasPrep(day) {
    return (day.lines || []).some(function (line) { return line.prepped > 0; });
  }

  function blank() {
    return { version: 1, sample: false, shopName: "我的店", dishes: [], days: [] };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return blank();
      const data = JSON.parse(raw);
      if (!data || data.version !== 1 || !Array.isArray(data.dishes) || !Array.isArray(data.days)) return blank();
      data.sample = Boolean(data.sample);
      data.shopName = String(data.shopName || "我的店").slice(0, 24);
      data.dishes = data.dishes.filter(function (dish) {
        return dish && dish.id && dish.name;
      }).slice(0, 30);
      data.dishes.forEach(function (dish) {
        dish.name = String(dish.name).slice(0, 24);
        dish.cost = calc.clampCost(dish.cost);
      });
      return data;
    } catch (error) {
      return blank();
    }
  }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (error) { /* 隐私模式可能写不进。 */ }
  }

  function currentView() {
    const name = location.hash.replace("#", "");
    return VIEWS.indexOf(name) >= 0 ? name : "close";
  }

  function todayISO() { return shiftISO(0); }

  function shiftISO(offset) {
    const date = new Date();
    date.setDate(date.getDate() + offset);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return date.getFullYear() + "-" + month + "-" + day;
  }

  function formatDate(iso) {
    const parts = iso.split("-");
    const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return Number(parts[1]) + "月" + Number(parts[2]) + "日 星期" + "日一二三四五六"[date.getDay()];
  }

  function formatYuan(n) {
    const value = calc.round2(n);
    const parts = value.toFixed(2).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  }

  function trimNum(n) {
    return String(Math.round(n * 10) / 10);
  }

  function uid() {
    return Math.random().toString(36).slice(2, 10);
  }

  function cssEscape(value) {
    return window.CSS && CSS.escape ? CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, "");
  }

  function h(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (key) {
      const value = attrs[key];
      if (value == null || value === false) return;
      if (key === "class") node.className = value;
      else if (key.indexOf("on") === 0 && typeof value === "function") node.addEventListener(key.slice(2).toLowerCase(), value);
      else node.setAttribute(key, value === true ? "" : String(value));
    });
    flatten(children).forEach(function (child) {
      if (child == null || child === false) return;
      node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    });
    return node;
  }

  function flatten(value) {
    if (value == null) return [];
    if (Array.isArray(value)) return value.reduce(function (all, item) { return all.concat(flatten(item)); }, []);
    return [value];
  }
})();
