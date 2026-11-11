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

  function halfPrice(cost) {
    return round2(clampCost(cost) * 0.7);
  }

  function wastedOf(line) {
    return Math.min(clampCount(line.wasted), clampCount(line.prepped));
  }

  function overprepWaste(line) {
    if (line && line.reason && line.reason !== "over") return 0;
    return wastedOf(line);
  }

  function keptOf(line) {
    if (!line || (line.reason && line.reason !== "over")) return 0;
    return Math.min(clampCount(line.kept), wastedOf(line));
  }

  function thrownOf(line) {
    return wastedOf(line) - keptOf(line);
  }

  function isSoldOut(line) {
    return Boolean(line && line.soldOut) && wastedOf(line) === 0 && clampCount(line.prepped) > 0;
  }

  function hasSoldOut(days) {
    return (days || []).some(function (day) {
      return (day.lines || []).some(isSoldOut);
    });
  }

  function lineLoss(line) {
    return round2(thrownOf(line) * clampCost(line.cost));
  }

  function dayTotal(lines) {
    return round2((lines || []).reduce(function (sum, line) {
      return sum + lineLoss(line);
    }, 0));
  }

  function weekdayOf(iso) {
    const parts = String(iso || "").split("-").map(Number);
    if (parts.length < 3 || !parts[0]) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]).getDay();
  }

  function historyPool(days, targetDate) {
    const sorted = (days || []).slice().sort(function (a, b) {
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
    if (targetDate) {
      const want = weekdayOf(targetDate);
      const same = sorted.filter(function (day) { return weekdayOf(day.date) === want; }).slice(-4);
      if (same.length >= 2) return { rows: same, sameWeekday: true, weekday: want };
    }
    return { rows: sorted.slice(-7), sameWeekday: false, weekday: targetDate ? weekdayOf(targetDate) : null };
  }

  function recommend(dishes, days, targetDate) {
    const pool = historyPool(days, targetDate);
    const recent = pool.rows;
    let best = null;
    (dishes || []).forEach(function (dish) {
      let prepped = 0;
      let wasted = 0;
      let used = 0;
      let soldOutFloor = 0;
      recent.forEach(function (day) {
        const line = (day.lines || []).find(function (item) {
          return item.dishId === dish.id;
        });
        if (!line || clampCount(line.prepped) <= 0) return;
        if (isSoldOut(line)) {
          soldOutFloor = Math.max(soldOutFloor, clampCount(line.prepped));
          return;
        }
        used += 1;
        prepped += clampCount(line.prepped);
        wasted += overprepWaste(line);
      });
      if (used < 2 || prepped <= 0) return;
      const avgPrepped = prepped / used;
      const avgWaste = wasted / used;
      const avgSold = (prepped - wasted) / used;
      if (wasted / prepped < 0.15 || avgWaste < 1) return;
      let suggest = Math.max(Math.ceil(avgPrepped * 0.6), Math.round(avgSold));
      if (soldOutFloor) suggest = Math.max(suggest, soldOutFloor);
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
        soldOutFloor: soldOutFloor,
        sameWeekday: pool.sameWeekday,
        weekday: pool.weekday,
      };
      if (!best || candidate.savedPerDay > best.savedPerDay) best = candidate;
    });
    return best;
  }

  function splitBatch(count) {
    const n = clampCount(count);
    if (n <= 2) return { first: n, hold: 0 };
    const first = Math.ceil(n * 0.7);
    return { first: first, hold: n - first };
  }

  function prepPlan(dishes, days, targetDate) {
    const pool = historyPool(days, targetDate);
    return (dishes || []).map(function (dish) {
      let prepped = 0;
      let sold = 0;
      let used = 0;
      let soldOutFloor = 0;
      pool.rows.forEach(function (day) {
        const line = (day.lines || []).find(function (item) { return item.dishId === dish.id; });
        if (!line || clampCount(line.prepped) <= 0) return;
        if (isSoldOut(line)) {
          soldOutFloor = Math.max(soldOutFloor, clampCount(line.prepped));
          return;
        }
        const made = clampCount(line.prepped);
        used += 1;
        prepped += made;
        sold += made - overprepWaste(line);
      });
      if (!used && !soldOutFloor) {
        return { dishId: dish.id, name: dish.name, buildTo: null, first: 0, hold: 0, sameWeekday: pool.sameWeekday, weekday: pool.weekday, samples: 0, soldOutFloor: 0 };
      }
      const avgSold = used ? sold / used : soldOutFloor;
      let buildTo = Math.max(soldOutFloor, Math.round(avgSold));
      if (used >= 2) {
        const capped = Math.max(Math.ceil((prepped / used) * 0.6), Math.round(avgSold));
        buildTo = Math.max(soldOutFloor, capped);
      }
      const batch = splitBatch(buildTo);
      return {
        dishId: dish.id,
        name: dish.name,
        buildTo: buildTo,
        first: batch.first,
        hold: batch.hold,
        sameWeekday: pool.sameWeekday,
        weekday: pool.weekday,
        samples: used,
        soldOutFloor: soldOutFloor,
      };
    });
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

  function coversOf(day) {
    return clampCount(day && day.covers);
  }

  function averageCovers(days, targetDate) {
    const pool = historyPool(days, targetDate);
    const nums = pool.rows.map(coversOf).filter(function (count) { return count > 0; });
    if (!nums.length) return null;
    const avg = nums.reduce(function (sum, count) { return sum + count; }, 0) / nums.length;
    return { avg: round2(avg), samples: nums.length, sameWeekday: pool.sameWeekday };
  }

  function scaleToCovers(count, floor, avg, expected) {
    if (count == null || !avg || !expected) return count;
    const scaled = Math.round(count * (expected / avg));
    return Math.max(floor || 0, Math.min(999, scaled));
  }

  function halfwayCall(expected, now) {
    const planned = clampCount(expected);
    if (!planned) return null;
    const seated = clampCount(now);
    const ratio = seated / planned;
    return {
      expected: planned,
      now: seated,
      ratio: round2(ratio),
      behind: ratio < 0.7,
      fireHold: ratio >= 0.7,
    };
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
    const batch = rec ? splitBatch(rec.suggest) : null;
    const next = rec
      ? "最该先改的是" + rec.name + "，明天先下锅 " + batch.first + " 份" + (batch.hold ? "，留 " + batch.hold + " 份等出餐过半。" : "。")
      : "先连续记下几天，才知道该少备哪一道。";
    return who + "这 " + summary.days + " 天倒掉了 " + summary.total.toFixed(2) + " 元。" + next + "按已记录的日均推到 30 天大约 " + summary.month.toFixed(2) + " 元。月费 " + PRICE + " 元，少倒掉其中一小部分就打平。";
  }

  return {
    PRICE: PRICE,
    round2: round2,
    clampCount: clampCount,
    clampCost: clampCost,
    halfPrice: halfPrice,
    wastedOf: wastedOf,
    isSoldOut: isSoldOut,
    overprepWaste: overprepWaste,
    keptOf: keptOf,
    thrownOf: thrownOf,
    hasSoldOut: hasSoldOut,
    weekdayOf: weekdayOf,
    historyPool: historyPool,
    coversOf: coversOf,
    averageCovers: averageCovers,
    scaleToCovers: scaleToCovers,
    halfwayCall: halfwayCall,
    lineLoss: lineLoss,
    dayTotal: dayTotal,
    recommend: recommend,
    prepPlan: prepPlan,
    splitBatch: splitBatch,
    rank: rank,
    projection: projection,
    pitch: pitch,
  };
});
