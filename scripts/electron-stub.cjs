const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-todo-test-'));
module.exports = {
  app: { getPath: () => tmp },
};
