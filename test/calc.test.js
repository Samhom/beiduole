const assert = require("assert");
const calc = require("../js/calc.js");

function dish(id, name, cost) {
  return { id: id, name: name, cost: cost };
}

function day(date, lines) {
  return { date: date, lines: lines };
}

function line(id, name, cost, prepped, wasted) {
  return { dishId: id, name: name, cost: cost, prepped: prepped, wasted: wasted };
}

assert.strictEqual(calc.lineLoss(line("a", "面", 8, 5, 9)), 40);
assert.strictEqual(calc.dayTotal([line("a", "面", 8, 10, 2), line("b", "蛋", 1.5, 4, 4)]), 22);

const beef = dish("beef", "牛肉面", 8);
const egg = dish("egg", "卤蛋", 1.5);
const days = [];
for (let i = 0; i < 6; i += 1) {
  days.push(day("2026-11-0" + (i + 1), [
    line("beef", "牛肉面", 8, 20, 6),
    line("egg", "卤蛋", 1.5, 40, 16),
  ]));
}

const rec = calc.recommend([beef, egg], days);
assert.strictEqual(rec.dishId, "beef");
assert.strictEqual(rec.suggest, 14);
assert.strictEqual(rec.savedPerDay, 48);
assert.strictEqual(rec.cautious, false);

assert.strictEqual(calc.recommend([beef], days.slice(0, 1)), null);

const wild = calc.recommend(
  [dish("soup", "汤", 10)],
  [day("2026-11-01", [line("soup", "汤", 10, 20, 18)]), day("2026-11-02", [line("soup", "汤", 10, 20, 18)])]
);
assert.strictEqual(wild.suggest, 12);
assert.strictEqual(wild.cautious, true);
assert.strictEqual(wild.savedPerDay, 80);

const summary = calc.projection(days);
assert.strictEqual(summary.days, 6);
assert.strictEqual(summary.total, 432);
assert.strictEqual(summary.month, 2160);

const ranked = calc.rank(days);
assert.strictEqual(ranked[0].name, "牛肉面");
assert.strictEqual(ranked[0].loss, 288);
assert.strictEqual(ranked[1].loss, 144);

assert.ok(calc.pitch("老陈面馆", summary, rec).includes("牛肉面"));
assert.ok(calc.pitch("老陈面馆", summary, rec).includes("199"));

const soldOutDays = [
  day("2026-11-01", [line("beef", "牛肉面", 8, 20, 0)]),
  day("2026-11-02", [line("beef", "牛肉面", 8, 20, 0)]),
  day("2026-11-03", [line("beef", "牛肉面", 8, 20, 8)]),
  day("2026-11-04", [line("beef", "牛肉面", 8, 20, 8)]),
];
soldOutDays[0].lines[0].soldOut = true;
soldOutDays[1].lines[0].soldOut = true;
assert.strictEqual(calc.recommend([beef], soldOutDays), null);

const floored = [
  day("2026-11-01", [line("beef", "牛肉面", 8, 10, 0)]),
  day("2026-11-02", [line("beef", "牛肉面", 8, 20, 8)]),
  day("2026-11-03", [line("beef", "牛肉面", 8, 20, 8)]),
];
floored[0].lines[0].soldOut = true;
const flooredRec = calc.recommend([beef], floored);
assert.strictEqual(flooredRec.suggest, 12);
assert.strictEqual(calc.soldOutFloorOf({ soldOut: true, prepped: 20, wasted: 0 }), 20);
assert.strictEqual(calc.soldOutFloorOf({ soldOut: true, prepped: 20, wasted: 0, soldOutWhen: "early" }), 22);
const earlyDays = [
  day("2026-11-02", [line("beef", "牛肉面", 8, 20, 0)]),
  day("2026-11-09", [line("beef", "牛肉面", 8, 20, 8)]),
  day("2026-11-16", [line("beef", "牛肉面", 8, 20, 8)]),
];
earlyDays[0].lines[0].soldOut = true;
earlyDays[0].lines[0].soldOutWhen = "early";
const earlySheet = calc.prepPlan([beef], earlyDays, "2026-11-23");
assert.strictEqual(earlySheet[0].soldOutFloor, 22);
assert.strictEqual(earlySheet[0].buildTo, 22);
assert.strictEqual(earlySheet[0].soldOutEarly, true);

const monday = [
  day("2026-11-02", [line("beef", "牛肉面", 8, 20, 8)]),
  day("2026-11-09", [line("beef", "牛肉面", 8, 20, 8)]),
  day("2026-11-05", [line("beef", "牛肉面", 8, 20, 0)]),
  day("2026-11-12", [line("beef", "牛肉面", 8, 20, 0)]),
];
const mondayRec = calc.recommend([beef], monday, "2026-11-16");
assert.strictEqual(mondayRec.sameWeekday, true);
assert.strictEqual(mondayRec.weekday, 1);
assert.strictEqual(mondayRec.suggest, 12);
assert.strictEqual(calc.recommend([beef], monday, "2026-11-19"), null);
const banquet = day("2026-11-23", [line("beef", "牛肉面", 8, 40, 30)]);
banquet.outlier = true;
const withBanquet = monday.concat([banquet]);
assert.strictEqual(calc.recommend([beef], withBanquet, "2026-11-30").suggest, 12);
assert.strictEqual(calc.dayTotal(banquet.lines), 240);
assert.strictEqual(calc.historyPool(withBanquet, "2026-11-30").rows.some(function (day) { return day.date === "2026-11-23"; }), false);
const meals = [
  day("2026-11-02", [line("beef", "牛肉面", 8, 20, 2)]),
  day("2026-11-09", [line("beef", "牛肉面", 8, 20, 2)]),
  day("2026-11-16", [line("beef", "牛肉面", 8, 20, 8)]),
  day("2026-11-23", [line("beef", "牛肉面", 8, 20, 8)]),
];
meals[0].service = "lunch";
meals[1].service = "lunch";
meals[2].service = "dinner";
meals[3].service = "dinner";
assert.strictEqual(calc.recommend([beef], meals, "2026-11-30", "dinner").suggest, 12);
assert.strictEqual(calc.recommend([beef], meals, "2026-11-30", "dinner").sameService, true);
assert.strictEqual(calc.recommend([beef], meals, "2026-11-30", "lunch"), null);

const ruined = [
  day("2026-11-01", [line("beef", "牛肉面", 8, 20, 8)]),
  day("2026-11-02", [line("beef", "牛肉面", 8, 20, 8)]),
];
ruined[0].lines[0].reason = "ruined";
ruined[1].lines[0].reason = "returned";
assert.strictEqual(calc.recommend([beef], ruined), null);
assert.strictEqual(calc.dayTotal(ruined[0].lines), 64);

const sheet = calc.prepPlan([beef, dish("new", "新品", 3)], monday, "2026-11-16");
assert.strictEqual(sheet[0].buildTo, 12);
assert.strictEqual(sheet[0].sameWeekday, true);
assert.strictEqual(sheet[1].buildTo, null);
assert.deepStrictEqual(calc.splitBatch(12), { first: 9, hold: 3 });
assert.deepStrictEqual(calc.splitBatch(2), { first: 2, hold: 0 });
assert.strictEqual(sheet[0].first, 9);
assert.strictEqual(sheet[0].hold, 3);
assert.strictEqual(sheet[0].pause, false);
const chronic = [
  day("2026-11-02", [line("beef", "牛肉面", 8, 20, 12)]),
  day("2026-11-09", [line("beef", "牛肉面", 8, 20, 12)]),
];
const paused = calc.prepPlan([beef], chronic, "2026-11-16");
assert.strictEqual(paused[0].pause, true);
assert.strictEqual(paused[0].buildTo, 0);
assert.strictEqual(calc.shouldPause(40, 12, 2, 0), false);
assert.strictEqual(calc.shouldPause(40, 24, 2, 10), false);

assert.strictEqual(calc.scaleToCovers(12, 0, 40, 20), 6);
assert.strictEqual(calc.scaleToCovers(12, 10, 40, 20), 10);
const coverDays = [day("2026-11-02", []), day("2026-11-09", [])];
coverDays[0].covers = 40;
coverDays[1].covers = 20;
assert.strictEqual(calc.averageCovers(coverDays, "2026-11-16").avg, 30);
assert.strictEqual(calc.halfwayCall(40, 20).fireHold, false);
assert.strictEqual(calc.halfwayCall(40, 28).fireHold, true);
assert.strictEqual(calc.halfwayCall(0, 10), null);
const kept = { prepped: 20, wasted: 6, cost: 8, reason: "over", kept: 4 };
assert.strictEqual(calc.lineLoss(kept), 16);
assert.strictEqual(calc.overprepWaste(kept), 6);
const unsafe = { prepped: 20, wasted: 6, cost: 8, reason: "ruined", kept: 4 };
assert.strictEqual(calc.keptOf(unsafe), 0);
assert.strictEqual(calc.lineLoss(unsafe), 48);
assert.strictEqual(calc.halfPrice(8), 5.6);
assert.strictEqual(calc.halfPrice(0), 0);
assert.deepStrictEqual(calc.freshCook(14, 4), { carry: 4, use: 4, fresh: 10, first: 7, hold: 3 });
assert.deepStrictEqual(calc.freshCook(14, 0), { carry: 0, use: 0, fresh: 14, first: 10, hold: 4 });
assert.strictEqual(calc.freshCook(null, 4).fresh, null);
const carryDays = [day("2026-11-15", [line("beef", "牛肉面", 8, 20, 6)])];
carryDays[0].lines[0].kept = 4;
assert.strictEqual(calc.carryFrom(carryDays, "beef", "2026-11-16"), 4);
assert.strictEqual(calc.carryFrom(carryDays, "beef", "2026-11-17"), 0);

console.log("calc ok");
