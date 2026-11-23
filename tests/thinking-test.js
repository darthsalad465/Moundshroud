// Chat › Show thinking: the switch exists on the live page, asks the model to think, opens the reasoning only when asked,
// and is remembered. Source checks only: no model is run here.
const fs = require('fs'), path = require('path');

module.exports = async ok => {
  const root = path.join(__dirname, '..'), html = fs.readFileSync(path.join(root, 'web', 'index.html'), 'utf8'), chat = fs.readFileSync(path.join(root, 'web', 'js', 'chat.js'), 'utf8');
  ok('show thinking: the switch is on the page the app serves (web/index.html)', /id="showthink"/.test(html));
  ok('show thinking: it asks the model to think even when Think harder is off', /think = opts\.voice \? false : \(showTh \|\| \$\('think'\)\.checked\)/.test(chat));
  ok('show thinking: thinking is only switched off for the faster retry, which drops the flag by name', /body\.think = false;/.test(chat) && /delete body\.think;/.test(chat));
  ok('show thinking: the live block is open only when the switch is on', /'<details' \+ \(showTh \? ' open' : ''\)/.test(chat));
  ok('show thinking: the choice is remembered', /ls\.get\('showthink', '0'\)/.test(chat) && /ls\.set\('showthink'/.test(chat));
  ok('show thinking: a model that cannot think is told so', /cannot show its thinking/.test(chat));
};
