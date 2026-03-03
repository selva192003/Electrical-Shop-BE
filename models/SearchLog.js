const mongoose = require('mongoose');

const searchLogSchema = new mongoose.Schema(
  {
    query: { type: String, required: true, lowercase: true, trim: true, index: true },
    count: { type: Number, default: 1 },
    hasResults: { type: Boolean, default: true },
    resultCount: { type: Number, default: 0 },
    lastSearchedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const SearchLog = mongoose.model('SearchLog', searchLogSchema);
module.exports = SearchLog;
