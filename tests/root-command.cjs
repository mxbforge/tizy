const assert=require('node:assert/strict'),cp=require('node:child_process'),wrap=require('../app/service/root-command');
const command="sh -c 'trap '\\''printf \"CHILD_EXIT\\n\"'\\'' EXIT; printf \"Тест кавычек\\n\"'; printf 'PARENT_OK\\n'";
const encoded=wrap(command);
assert.match(encoded,/^printf %s [A-Za-z0-9+/=]+ \| base64 -d \| \/bin\/sh$/);
const result=cp.execFileSync('/bin/sh',['-c',encoded],{encoding:'utf8'});
assert.equal(result,'Тест кавычек\nCHILD_EXIT\nPARENT_OK\n');
console.log('Nested shell quotes, Unicode and exit trap survive exact command transport: passed');
