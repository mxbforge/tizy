'use strict';
function rootUnavailable(e){return !!(e&&/^VETRO_(ROOT_PENDING|NOT_FOUND|TIMEOUT|CLOSED|ABORTED|HTTP_\d+)$/.test(e.code||''));}
function message(e){
    if(rootUnavailable(e))return 'Ожидаем root-доступ';
    var text=String(e&&e.message||e||'');
    if(/curl: \((?:5|6|7|28|35|52|55|56)\)/.test(text))return 'Не удалось установить VPN-соединение. Проверьте доступность сервера из сети телевизора.';
    return text;
}
module.exports={rootUnavailable:rootUnavailable,message:message};
