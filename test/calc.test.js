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
assert.strictEqual(flooredRec.soldOutFloor, 10);

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

console.log("calc ok");
