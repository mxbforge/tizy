'use strict';
var q=require('./network').quote;
var BASE='/opt/usr/home/owner/share/tizyp-runtime-uep';
var CORE=BASE+'/ro/xray';
var ARM64_HASH='5939649960deaf535bcd5f7ce0467a2b1d63b72a2758a6f42eade714ae8d5328';
var HASH='2a893d5b5f7cf5a33168c102f01771ed69a674abeab0b8fb085b1ddf098cf52c';
function prepare(packagedCore){
    var src=BASE+'/src',ro=BASE+'/ro';
    return [
        'set -e','case $(uname -m) in armv7l|armv8l) sever_packaged='+q(packagedCore)+'; sever_hash='+HASH+';; aarch64|arm64) sever_packaged='+q(packagedCore+'-arm64')+'; sever_hash='+ARM64_HASH+';; *) echo TIZY_UNSUPPORTED_ARCH >&2; exit 1;; esac','test -f /sys/fs/cgroup/net_cls/net_cls.classid','command -v sha256sum >/dev/null','command -v mount >/dev/null','umask 077','test ! -L '+q(BASE),
        'printf \"%s  %s\\n\" \"$sever_hash\" \"$sever_packaged\" | sha256sum -c - >/dev/null',
        'sever_created=0',
        'trap \'sever_rc=$?; if [ "$sever_rc" -ne 0 ] && [ "$sever_created" -eq 1 ]; then umount '+ro+' 2>/dev/null || true; fi\' EXIT',
        'if ! grep -E '+q('^[^ ]+ '+ro+' [^ ]+ ro(,| )')+' /proc/mounts >/dev/null || ! printf \"%s  %s\\n\" \"$sever_hash\" '+q(CORE)+' | sha256sum -c - >/dev/null 2>&1; then',
        '  mkdir -p '+q(src)+' '+q(ro),
        '  chmod 700 '+q(BASE)+' '+q(src)+' '+q(ro),
        '  if grep -F '+q(' '+ro+' ')+' /proc/mounts >/dev/null; then umount '+q(ro)+'; fi',
        '  cp \"$sever_packaged\" '+q(src+'/xray.next'),
        '  chmod 700 '+q(src+'/xray.next'),
        '  mv -f '+q(src+'/xray.next')+' '+q(src+'/xray'),
        '  mount --bind '+q(src)+' '+q(ro),
        '  sever_created=1',
        '  mount -o remount,ro,bind '+q(ro),
        'fi',
        'printf \"%s  %s\\n\" \"$sever_hash\" '+q(CORE)+' | sha256sum -c - >/dev/null'
    ].join('\n');
}
module.exports={core:CORE,prepare:prepare,hash:HASH,hashes:{armv7:HASH,arm64:ARM64_HASH},base:BASE};
