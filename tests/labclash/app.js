// Lists labeling conflicts of input and select elements.
exports.reporter = async page => {
  const report = require('../../procs/test/labClash').labClash(page, true);
  return report;
};
