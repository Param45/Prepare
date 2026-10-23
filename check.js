// Data self-check: node check.js
const assert = require("assert");
const Q = require("./questions.js");

assert.strictEqual(Q.length, 110, "question count");
const seen = new Set();
for (const q of Q) {
  assert(q.q.length > 10, `${q.id}: question text`);
  assert.strictEqual(q.options.length, 4, `${q.id}: 4 options`);
  q.options.forEach((o, i) => assert(o.length > 0 && !/\[Correct\]|\[RED\]/.test(o), `${q.id}: option ${i}`));
  assert(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, `${q.id}: answer`);
  assert(!seen.has(q.q), `${q.id}: duplicate`);
  seen.add(q.q);
}
const weeks = [...new Set(Q.map((q) => q.week))].sort((a, b) => a - b);
assert.deepStrictEqual(weeks, [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12], "weeks");
weeks.forEach((w) => assert.strictEqual(Q.filter((q) => q.week === w).length, 10, `week ${w} count`));
console.log("ok:", Q.length, "questions,", weeks.length, "weeks");
console.log("answers:", weeks.map((w) => `W${w} ` + Q.filter((q) => q.week === w).map((q) => "ABCD"[q.answer]).join("")).join(" | "));
