// A tiny in-memory stand-in for the Mongoose Session model, implementing only
// the query / update operators the interview flow uses:
//   filters : _id, user, status, questionsPending, questions.$elemMatch{id, feedback}
//   updates : $set (incl. 'questions.$.feedback'), $push { questions: { $each } }
// It exists so tests can run the REAL controller + interviewFlow code without a
// MongoDB server. (The real update documents are separately validated against
// the schema with Mongoose's own casting — see the notes in the test file.)

let seq = 0;
const newId = () => `64b7f0c2a1b2c3d4e5${String(++seq).padStart(6, '0')}`;
const clone = v => JSON.parse(JSON.stringify(v));

const store = new Map();

const matches = (doc, filter) => {
  for (const [key, cond] of Object.entries(filter || {})) {
    if (key === '$or') continue; // not needed for the flows under test
    if (key === 'questions' && cond && cond.$elemMatch) {
      const ok = (doc.questions || []).some(q =>
        Object.entries(cond.$elemMatch).every(([k, v]) => q[k] === v)
      );
      if (!ok) return false;
      continue;
    }
    if (String(doc[key]) !== String(cond)) return false;
  }
  return true;
};

class FakeSession {
  constructor(data) {
    Object.assign(this, clone(data));
    this._id = this._id || newId();
    this.questions = (this.questions || []).map(q => ({ _id: newId(), ...q }));
    this.status = this.status || 'active';
    this.startedAt = this.startedAt ? new Date(this.startedAt) : new Date();
    this.questionsPending = Boolean(this.questionsPending);
    this.expectedQuestionCount = this.expectedQuestionCount || 0;
  }

  async save() {
    store.set(String(this._id), clone(this));
    return this;
  }

  static reset() { store.clear(); seq = 0; }
  static _get(id) { const d = store.get(String(id)); return d ? clone(d) : null; }
  static _put(doc) { store.set(String(doc._id), clone(doc)); }

  static async create(data) {
    const doc = new FakeSession(data);
    await doc.save();
    return doc;
  }

  // Used by the daily-limit check (utils/planUsage.js). Counts this user's stored
  // sessions; the date window and abandoned-session exclusion are not modelled.
  static async countDocuments(filter) {
    const uid = (filter?.$or || []).map(c => c.user ?? c.userId).find(Boolean);
    return [...store.values()].filter(d => String(d.user) === String(uid)).length;
  }

  static find() {
    const q = { lean: () => q, then: (res, rej) => Promise.resolve([]).then(res, rej) };
    return q;
  }

  static findOne(filter) {
    const found = [...store.values()].find(d => matches(d, filter));
    const q = {
      select: () => q,
      lean: () => { q._lean = true; return q; },
      then: (res, rej) => {
        let out = null;
        if (found) out = q._lean ? clone(found) : Object.assign(new FakeSession({}), clone(found), {
          startedAt: new Date(found.startedAt),
        });
        return Promise.resolve(out).then(res, rej);
      },
    };
    return q;
  }

  static async updateOne(filter, update) {
    const doc = [...store.values()].find(d => matches(d, filter));
    if (!doc) return { matchedCount: 0, modifiedCount: 0 };

    for (const [field, value] of Object.entries(update.$set || {})) {
      if (field === 'questions.$.feedback') {
        const em = filter.questions.$elemMatch;
        const target = doc.questions.find(q => Object.entries(em).every(([k, v]) => q[k] === v));
        target.feedback = value;
      } else {
        doc[field] = value;
      }
    }
    if (update.$push && update.$push.questions) {
      const items = update.$push.questions.$each || [update.$push.questions];
      items.forEach(q => doc.questions.push({ _id: newId(), ...clone(q) }));
    }
    store.set(String(doc._id), doc);
    return { matchedCount: 1, modifiedCount: 1 };
  }
}

module.exports = FakeSession;
