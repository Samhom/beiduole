(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.BEIDUOLE = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PRICE = 199;

  function round2(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  function clampCount(n) {
    const value = Math.floor(Number(n));
    if (!Number.isFinite(value) || value < 0) return 0;
    return Math.min(999, value);
  }

  function clampCost(n) {
    const value = Number(n);
    if (!Number.isFinite(value) || value < 0) return 0;
    return round2(Math.min(99999, value));
  }

  function wastedOf(line) {
    return Math.min(clampCount(line.wasted), clampCount(line.prepped));
  }

  function lineLoss(line) {
    return round2(wastedOf(line) * clampCost(line.cost));
  }

  function dayTotal(lines) {
    return round2((lines || []).reduce(function (sum, line) {
      return sum + lineLoss(line);
    }, 0));
  }

  function recommend(dishes, days) {
    const recent = (days || []).slice().sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    }).slice(-7);
    let best = null;
    (dishes || []).forEach(function (dish) {
      let prepped = 0;
      let wasted = 0;
      let used = 0;
      recent.forEach(function (day) {
        const line = (day.lines || []).find(function (item) {
          return item.dishId === dish.id;
        });
        if (!line || clampCount(line.prepped) <= 0) return;
        used += 1;
        prepped += clampCount(line.prepped);
        wasted += wastedOf(line);
      });
      if (used < 2 || prepped <= 0) return;
      const avgPrepped = prepped / used;
      const avgWaste = wasted / used;
      const avgSold = (prepped - wasted) / used;
      if (wasted / prepped < 0.15 || avgWaste < 1) return;
      const suggest = Math.max(Math.ceil(avgPrepped * 0.6), Math.round(avgSold));
      const cut = avgPrepped - suggest;
      if (cut < 1) return;
      const savedPerDay = round2(Math.min(cut, avgWaste) * clampCost(dish.cost));
      if (savedPerDay < 1) return;
      const candidate = {
        dishId: dish.id,
        name: dish.name,
        suggest: suggest,
        avgSold: round2(avgSold),
        avgPrepped: round2(avgPrepped),
        savedPerDay: savedPerDay,
        cautious: suggest > Math.round(avgSold) + 0.001,
      };
      if (!best || candidate.savedPerDay > best.savedPerDay) best = candidate;
    });
    return best;
  }

  function rank(days) {
    const map = new Map();
    (days || []).forEach(function (day) {
      (day.lines || []).forEach(function (line) {
        const key = line.dishId || line.name;
        const current = map.get(key) || { name: line.name, loss: 0, wasted: 0 };
        current.name = line.name || current.name;
        current.loss = round2(current.loss + lineLoss(line));
        current.wasted += wastedOf(line);
        map.set(key, current);
      });
    });
    return Array.from(map.values()).filter(function (item) {
      return item.loss > 0;
    }).sort(function (a, b) {
      return b.loss - a.loss;
    });
  }

  function projection(days) {
    const list = days || [];
    if (!list.length) return null;
    const total = dayTotal(list.flatMap(function (day) {
      return day.lines || [];
    }));
    const avg = round2(total / list.length);
    return { days: list.length, total: total, avg: avg, month: round2(avg * 30) };
  }

  function pitch(shopName, summary, rec) {
    if (!summary) return "";
    const who = shopName && shopName !== "我的店" ? shopName + "，" : "";
    const next = rec
      ? "最该先改的是" + rec.name + "，明天先备 " + rec.suggest + " 份。"
      : "先连续记下几天，才知道该少备哪一道。";
    return who + "这 " + summary.days + " 天倒掉了 " + summary.total.toFixed(2) + " 元。" + next + "按已记录的日均推到 30 天大约 " + summary.month.toFixed(2) + " 元。月费 " + PRICE + " 元，少倒掉其中一小部分就打平。";
  }

  return {
    PRICE: PRICE,
    round2: round2,
    clampCount: clampCount,
    clampCost: clampCost,
    wastedOf: wastedOf,
    lineLoss: lineLoss,
    dayTotal: dayTotal,
    recommend: recommend,
    rank: rank,
    projection: projection,
    pitch: pitch,
  };
});
