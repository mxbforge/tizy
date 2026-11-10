'use strict';
var http=require('http'),https=require('https'),fs=require('fs'),path=require('path'),dns=require('dns'),url=require('url');
var profiles=require('./profiles'),network=require('./network'),q=network.quote,i18n=require('../i18n');
var runtime=require('./runtime'),tvNetwork=require('./network-tv'),appProxy=require('./app-proxy');
var appRoutingInProgress=false;
var appMonitor=new appProxy.Monitor({onError:function(error){event(error.message,'network','error');if(phase==='connected'&&!appRoutingInProgress)connectionLost(error.message,connectionGeneration);}});
var applicationList={loaded:false,items:[],error:'',updatedAt:0};
function refreshApplications(){return root(appProxy.registryCommand()).then(function(output){applicationList={loaded:true,items:appProxy.parseRegistry(output),error:'',updatedAt:Date.now()};return applicationList.items;},function(){applicationList.error='Не удалось получить приложения ТВ. Проверьте готовность службы.';throw new Error(applicationList.error);});}
function configureAppRouting(value){
    appRoutingInProgress=true;appMonitor.stop();connectionGeneration++;
    return root(appProxy.cleanup()+'\n'+(value.enabled?appProxy.prepare():'true')).then(function(){
        appMonitor.start(value);return root(tvNetwork.install(value));
    }).then(function(){return root('( '+network.verifyPid(ROOT,CORE)+' ) && '+tvNetwork.verify());}).then(function(){
        if(appMonitor.error)throw new Error(appMonitor.error);
    }).then(function(){appRoutingInProgress=false;},function(error){appRoutingInProgress=false;throw error;});
}
function updateAppProxy(value){
    var next=appProxy.preferences(value),previous=appProxy.preferences(state.settings.appProxy);
    if(phase==='connecting'||phase==='disconnecting')throw new Error('Дождитесь завершения подключения');
    return refreshApplications().then(function(items){
        var allowed=items.map(function(item){return item.id;});
        ['direct','vpn'].forEach(function(mode){if(next[mode].some(function(id){return allowed.indexOf(id)<0&&previous[mode].indexOf(id)<0;}))throw new Error('Приложение отсутствует в списке ТВ');});
        if(JSON.stringify(next)===JSON.stringify(previous))return;
        var reconnect=phase==='connected';state.settings.appProxy=next;save();
        event('Настройки прокси по приложениям сохранены','connection','info',next.enabled?(next.mode==='direct'?'Напрямую':'Через VPN')+' · '+appProxy.selected(next).length:'Выключено');
        if(!reconnect||appProxy.policyKey(next)===appProxy.policyKey(previous))return;
        return configureAppRouting(next).then(function(){event('Маршрутизация применена без переподключения','network','info');}).catch(function(error){
            state.settings.appProxy=previous;save();event('Изменение маршрутизации отменено','connection','warning');
            return configureAppRouting(previous).catch(function(){return connect(state.selected,'tv').catch(function(){});}).then(function(){throw error;});
        });
    });
}
var connectionInfo=require('./connection-info'),traffic=require('./traffic'),checkTunnel=require('./tunnel-check');
var rootCommand=require('./root-command'),connectionErrors=require('./connection-errors'),VetroClient=require('./vetro-client'),installation=require('./installation'),ports=require('./ports').values;var vetro;
var ROOT=process.env.SEVER_DATA || '/opt/usr/home/owner/apps_rw/severtvapp/data';
var PACKAGED_CORE=path.resolve(__dirname,'../core/xray'),CORE=runtime.core;
var TOKEN;
var Pairing=require('./pairing');
var LocalPairing=require('./local-pairing'),HappPairing=require('./happ-pairing'),V2RayTunPairing=require('./v2raytun-pairing'),pairProtocol='incy';
var publicIP=require('./addresses').publicIP,ipFamily=require('./ip-family');
var Logging=require('../logging'),EventLog=require('./event-log'),eventLog=new EventLog(redact),LogExport=require('./log-export'),logExport=new LogExport();
try{fs.mkdirSync(ROOT,448);}catch(e){if(e.code!=='EEXIST')throw e;}
TOKEN=installation.token(ROOT);vetro=new VetroClient({cacheFile:path.join(ROOT,'vetro-port.json')});
var state={servers:[],selected:null,mode:'tv'},events=eventLog.items,phase='disconnected',busy=false,lastError='',version='',ready=false,importShape=null;
var peerInfo={},selectedProbe={},connectionGeneration=0,measuringPeer=false,trafficInfo={},connectedAt=0,measuringTraffic=false;
var checkingHealth=false,healthFailures=0,lastHealthRequest=0;
var serverPings=Object.create(null),pingSweep={running:false,completed:0,total:0},pingGeneration=0;
var Countries=require('./countries'),countries=new Countries({file:path.join(ROOT,'country-cache.json')});
function cancelPings(){pingGeneration++;pingSweep.running=false;}
function measureAll(){
    if(pingSweep.running)return;
    if(phase==='connecting'||phase==='disconnecting')throw new Error('Дождитесь завершения подключения');
    var list=state.servers.slice(),generation=++pingGeneration,next=0;
    if(!list.length)throw new Error('Добавьте серверы');
    serverPings=Object.create(null);pingSweep={running:true,completed:0,total:list.length};event('Начата проверка серверов','network','info',String(list.length));
    var ping=phase==='connected'&&state.mode==='tv'?function(ip,port){return connectionInfo.groupPing(root,ip,port);}:null;
    function worker(){
        if(generation!==pingGeneration||next>=list.length)return Promise.resolve();
        var p=list[next++];
        return connectionInfo.probe(p,ping,state.settings.ipFamily).catch(function(e){event('Адрес сервера недоступен','network','warning',p.name+' · '+redact(e.message));return {profileId:p.id,latencyMs:null,reachable:false,measuredAt:Date.now()};}).then(function(result){
            if(generation!==pingGeneration)return;
            serverPings[p.id]=result;pingSweep.completed++;logPing(result,p.name,'debug');
            if(phase!=='connected'&&p.id===state.selected)selectedProbe=result;
            if(pingSweep.completed===pingSweep.total){pingSweep.running=false;event('Проверка серверов завершена','network','info',pingSweep.completed+'/'+pingSweep.total);}
            return worker();
        });
    }
    for(var i=0;i<Math.min(3,list.length);i++)worker();
}
try{state=JSON.parse(fs.readFileSync(path.join(ROOT,'profiles.json'),'utf8'));}catch(e){}
state.mode='tv';state.settings=state.settings||{};if(!i18n.validPreference(state.settings.language))state.settings.language='auto';state.settings.autoConnect=state.settings.autoConnect===true;if(['auto','ipv4','ipv6'].indexOf(state.settings.ipFamily)<0)state.settings.ipFamily='auto';try{state.settings.log=Logging.preferences(state.settings.log);}catch(e){state.settings.log=Logging.defaults();}eventLog.enabled=state.settings.log.enabled;try{state.settings.appProxy=appProxy.preferences(state.settings.appProxy);}catch(e){state.settings.appProxy=appProxy.preferences();}
var bootId;try{bootId=fs.readFileSync('/proc/sys/kernel/random/boot_id','utf8').trim();}catch(e){bootId='process-'+process.pid;}
var probing=false,probePromise=null;
function event(s,category,level,detail){eventLog.add(s,category,level,detail);}
function logPing(info,name,level){event(info.reachable===false?'Сервер не ответил на проверку':'Пинг сервера обновлён','network',info.reachable===false?'warning':level||'info',(name?name+' · ':'')+(info.serverIP||'—')+(typeof info.latencyMs==='number'?' · '+Math.round(info.latencyMs)+' мс':''));}
function save(){var p=path.join(ROOT,'profiles.json');fs.writeFileSync(p+'.tmp',JSON.stringify(state),{mode:384});fs.renameSync(p+'.tmp',p);}
function write(n,s){fs.writeFileSync(path.join(ROOT,n),s,{mode:384});}
write('auth.header','X-Sever-Token: '+TOKEN+'\n');
function lease(){write('lease',String(Math.floor(Date.now()/1000)));}
function root(cmd){return vetro.execute(rootCommand(cmd)).catch(function(e){if(connectionErrors.rootUnavailable(e))ready=false;throw e;});}
function redact(s){s=String(s).replace(/Vetro/gi,'Root service');state.servers.forEach(function(p){[p.secret,p.publicKey,p.shortId].forEach(function(value){if(value&&value.length>=4)s=s.split(value).join('[ключ скрыт]');});});if(TOKEN)s=s.split(TOKEN).join('[ключ скрыт]');return s;}
function delay(ms){return new Promise(function(r){setTimeout(r,ms);});}
function probe(){if(probing)return probePromise;probing=true;event('Проверяем готовность ядра','system','debug');probePromise=vetro.find().then(function(target){require('./ports').avoid(target.port);return root(runtime.prepare(PACKAGED_CORE));}).then(function(){return root(q(CORE)+' version');}).then(function(s){version=s.split('\n')[0];if(!ready)event('Ядро готово','system','info',version);ready=true;lastError='';return true;},function(e){var prior=lastError;ready=false;lastError=e.code==='VETRO_NOT_FOUND'?'Vetro не найден. Откройте Vetro на телевизоре.':e.code==='VETRO_ROOT_PENDING'?'Ожидаем root-доступ':/TIZY_UNSUPPORTED_ARCH/.test(e.message)?'Эта сборка поддерживает телевизоры ARMv7 и ARM64.':/not signed|Operation not permitted|Permission denied/i.test(e.message)?'Tizen блокирует запуск ядра. Временное разрешение недоступно.':'Нет доступа к ядру: '+redact(e.message).slice(0,250);if(prior!==lastError)event('Ядро недоступно','system','warning',lastError);return false;}).then(function(ok){probing=false;return ok;},function(e){probing=false;throw e;});return probePromise;}
function disconnect(){appMonitor.stop();try{write('lease','0');}catch(e){}lastError='';cancelPings();connectionGeneration++;peerInfo={};selectedProbe={};trafficInfo={};connectedAt=0;phase='disconnecting';event('Отключаем VPN','connection');return root(network.stop(ROOT,CORE)).then(function(){phase='disconnected';event('Подключение отключено, обычная сеть восстановлена','connection');},function(e){phase='disconnected';lastError=redact(e.message).slice(0,350);event('Ошибка отключения VPN','connection','error',lastError);throw e;});}
function connect(id,mode){
    mode='tv';
    var p=state.servers.filter(function(x){return x.id===id;})[0];if(!p)throw new Error('Выберите сервер');
    if(mode!=='socks' && mode!=='tv')throw new Error('Некорректный режим');
    appMonitor.stop();cancelPings();connectionGeneration++;peerInfo={};selectedProbe={};trafficInfo={};connectedAt=0;phase='connecting';lastError='';state.selected=id;state.mode=mode;save();
    return Promise.resolve().then(function(){write('lease','0');return root(network.stop(ROOT,CORE));}).then(function(){ipFamily.validate(p,state.settings.ipFamily);event('Параметры подключения','connection','debug',p.name+' · '+p.protocol.toUpperCase()+' · '+p.network.toUpperCase()+' · '+p.security.toUpperCase()+' · '+state.settings.ipFamily);return probe();}).then(function(ok){if(!ok)throw new Error(lastError);if(mode==='tv')return root(tvNetwork.preflight()).catch(function(){throw new Error('В ядре ТВ недоступны необходимые средства перенаправления IPv4 и блокировки обхода IPv6.');});})
    .then(function(){write('active.json',JSON.stringify(profiles.config(p,mode,state.settings.ipFamily)));write('core.log','');lease();return root(q(CORE)+' run -test -c '+q(ROOT+'/active.json'));})
    .then(function(){event('Конфигурация Xray проверена','system','debug');return root(network.start(ROOT,CORE,mode,state.settings.appProxy));}).then(function(){return delay(1000);})
    .then(function(){return checkTunnel(function(){return root('( '+network.verifyPid(ROOT,CORE)+' ) && '+tvNetwork.enter('curl --connect-timeout 5 --max-time 12 --socks5-hostname 127.0.0.1:'+ports.socks+' -f -sS -o /dev/null -w "%{http_code}" https://www.gstatic.com/generate_204'));},{retry:function(){event('Повторяем проверку VPN после временной ошибки','network','warning');}});})
    .then(function(){event('Туннель прошёл проверку','network','info','HTTP 204');return connectionInfo.measure(root,ROOT,CORE,p,true).then(function(info){peerInfo=info;if(info.serverIP)logPing(info,p.name,'debug');},function(){peerInfo={};});})
    .then(function(){appMonitor.start(state.settings.appProxy);if(mode==='tv')return root(tvNetwork.install(state.settings.appProxy)).then(function(){var check='curl -4 --noproxy '+q('*')+' --max-time 15 -f -sS -o /dev/null -w "%{http_code}" https://www.gstatic.com/generate_204';if(appProxy.selective(state.settings.appProxy)&&state.settings.appProxy.mode==='vpn')check=appProxy.enter(check);return checkTunnel(function(){return root(tvNetwork.verify()+' && '+check);},{retry:function(){event('Повторяем проверку VPN после временной ошибки','network','warning');}});}).then(function(){event(state.settings.appProxy.enabled?'Маршрутизация по приложениям включена':'Трафик приложений проходит через VPN','network','info','HTTP 204');});})
    .then(function(){if(appMonitor.error)throw new Error(appMonitor.error);phase='connected';connectedAt=Date.now();healthFailures=0;lastHealthRequest=Date.now();readTraffic();event('VPN подключён к серверу: '+p.name,'connection');})
    .catch(function(e){appMonitor.stop();return root(network.stop(ROOT,CORE)).catch(function(){}).then(function(){phase='error';lastError=redact(connectionErrors.message(e)).slice(0,350);event('Подключение не установлено: '+lastError,'connection','error',lastError!==redact(e.message)?redact(e.message):undefined);throw new Error(lastError);});});
}
function subscription(address,depth){return new Promise(function(resolve,reject){
    var u=url.parse(address);if(u.protocol!=='https:'||u.auth||!u.hostname||(u.port&&u.port!=='443')||depth>3)return reject(new Error('Подписка должна быть публичной HTTPS-ссылкой на порту 443'));
    dns.lookup(u.hostname,{all:true},function(err,records){if(err)return reject(new Error('Адрес подписки недоступен'));var addresses=records.filter(function(r){return publicIP(r.address);}),chosen=[];[6,4].forEach(function(f){var r=addresses.filter(function(a){return a.family===f;})[0];if(r)chosen.push(r);});if(!chosen.length)return reject(new Error('Адрес подписки относится к локальной или служебной сети'));
      function attempt(index){if(index>=chosen.length)return reject(new Error('Сервер подписки недоступен по IPv4 и IPv6'));
        var req=https.get({hostname:chosen[index].address,servername:u.hostname,port:443,path:u.path,headers:{Host:u.hostname,'User-Agent':'TIZY/0.14.4'}},function(res){
            if([301,302,303,307,308].indexOf(res.statusCode)>=0){res.resume();return subscription(url.resolve(address,res.headers.location || ''),depth+1).then(resolve,reject);}
            if(res.statusCode!==200){res.resume();return reject(new Error('Сервер подписки ответил HTTP '+res.statusCode));}
            var data='';res.on('data',function(b){data+=b;if(Buffer.byteLength(data)>524288){req.abort();reject(new Error('Подписка превышает 512 КБ'));}});res.on('end',function(){resolve(data);});
        });var retried=false;function retry(){if(retried)return;retried=true;attempt(index+1);}req.on('error',retry);req.setTimeout(8000,function(){req.abort();retry();});
      }attempt(0);
    });
});}
function importText(text,valid){return (/^https:\/\//.test(text.trim())?subscription(text.trim(),0):Promise.resolve(text)).then(function(raw){if(valid&&!valid())throw new Error('Передача отменена');var incoming=profiles.parseMany(raw);if(state.servers.length+incoming.length>200)throw new Error('Список ограничен 200 серверами');incoming.forEach(function(p){p.name=profiles.uniqueName(p.name,state.servers);p.id=require('crypto').randomBytes(8).toString('hex');state.servers.push(p);});if(!state.selected)state.selected=incoming[0].id;save();event('Добавлено серверов: '+incoming.length,'servers');});}
function receivePayload(p,allowBusy){
    function shape(value,depth){if(value===null)return 'null';if(Array.isArray(value))return {type:'array',length:value.length,item:depth<3&&value.length?shape(value[0],depth+1):null};if(typeof value!=='object')return typeof value;var out=Object.create(null);Object.keys(value).slice(0,32).forEach(function(k){var key=/^[A-Za-z_][A-Za-z0-9_]{0,40}$/.test(k)?k:'[key]';out[key]=depth<3?shape(value[k],depth+1):typeof value[k];});return out;}
    importShape=shape(p,0);
    if(!p || (p.v!=null && p.v!==1)) return Promise.reject(new Error('Версия передачи пока не поддерживается'));
    if(p.type==null)p.type='subscription';
    if(busy && !allowBusy) return Promise.reject(new Error('Клиент занят. Повторите передачу.'));
    var text=typeof p.url==='string'?p.url:null;
    if(p.type==='servers' && Array.isArray(p.servers) && p.servers.every(function(s){return typeof s==='string';}))text=p.servers.join('\n');
    if(p.type==='config' && Array.isArray(p.servers)){
        var incoming;try{incoming=p.servers.map(function(s){return profiles.fromIncy(s);});if(!incoming.length || state.servers.length+incoming.length>200)throw new Error('Список ограничен 200 серверами');}catch(e){return Promise.reject(e);}
        incoming.forEach(function(s){s.name=profiles.uniqueName(s.name,state.servers);s.id=require('crypto').randomBytes(8).toString('hex');state.servers.push(s);});if(!state.selected)state.selected=incoming[0].id;save();event('Из Incy добавлено серверов: '+incoming.length,'servers');return Promise.resolve();
    }
    if(!text || ['subscription','server','servers'].indexOf(p.type)<0)return Promise.reject(new Error('Этот формат отправки Incy пока не поддерживается. Передайте ссылку на подписку.'));
    busy=true;return importText(text).then(function(){busy=false;event('Подключение получено из Incy','servers');},function(e){busy=false;throw e;});
}
var pairing=new Pairing(receivePayload),localPairing=new LocalPairing(function(p){return receivePayload(p,true);});
var happPairing=new HappPairing(function(text,valid){return Promise.all(text.split('\n').map(function(line){return /^https:\/\//.test(line)?subscription(line,0):Promise.resolve(line);})).then(function(parts){return importText(parts.join('\n'),valid);}).then(function(){event('Подключение получено из Happ','servers');});},{event:function(text,level,detail){event(text,'servers',level,detail);}});
var v2raytunPairing=new V2RayTunPairing(function(payload,valid){
    var promise;if(payload.profiles){promise=Promise.resolve().then(function(){if(!valid())throw new Error('Передача отменена');if(state.servers.length+payload.profiles.length>200)throw new Error('Список ограничен 200 серверами');payload.profiles.forEach(function(p){p.name=profiles.uniqueName(p.name,state.servers);p.id=require('crypto').randomBytes(8).toString('hex');state.servers.push(p);});if(!state.selected)state.selected=payload.profiles[0].id;save();event('Добавлено серверов: '+payload.profiles.length,'servers');});}else promise=importText(payload.text,valid);
    return promise.then(function(){event('Подключение получено из v2RayTun','servers');});
},{event:function(text,level,detail){event(text,'servers',level,detail);}});
function activePairing(){return pairProtocol==='v2raytun'?v2raytunPairing:pairProtocol==='happ'?happPairing:pairing;}
function countryAddress(p){return phase==='connected'&&p.id===state.selected&&peerInfo.serverIP||selectedProbe.profileId===p.id&&selectedProbe.serverIP||serverPings[p.id]&&serverPings[p.id].serverIP||null;}
function snapshot(){return {name:'TIZY',version:'0.14.4',phase:phase,ready:ready,vetro:vetro.view,coreVersion:version,error:autoConnect.exhausted?(Date.now()<autoConnect.exhaustedAt+5000?'Не удалось подключиться за 3 попытки':''):lastError,errorExpiresAt:autoConnect.exhausted?autoConnect.exhaustedAt+5000:null,mode:state.mode,settings:state.settings,applications:applicationList,autoConnect:autoConnect.view(),selected:state.selected,connection:peerInfo,selectedProbe:selectedProbe,serverPings:serverPings,pingSweep:pingSweep,connectedAt:connectedAt,traffic:trafficInfo,pairing:activePairing().view,importShape:importShape,servers:state.servers.map(function(p){return {id:p.id,name:p.name,protocol:p.protocol,network:p.network,security:p.security,countryCode:countries.peek(p,countryAddress(p),state.settings.ipFamily)};}),events:events,logExport:logExport.view,busy:busy};}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function body(req){return new Promise(function(resolve,reject){var s='';req.on('data',function(b){s+=b;if(Buffer.byteLength(s)>524288){reject(new Error('Слишком большой запрос'));req.destroy();}});req.on('end',function(){try{resolve(JSON.parse(s));}catch(e){reject(new Error('Некорректный запрос'));}});req.on('error',reject);});}
var server=http.createServer(function(req,res){
    if(req.headers.origin==='null'){res.setHeader('Access-Control-Allow-Origin','null');res.setHeader('Vary','Origin');}
    if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, X-Sever-Token'});res.end();return;}
    if(req.headers['x-sever-token']!==TOKEN){json(res,403,{error:'Нет доступа'});return;}
    if(req.method==='GET' && req.url==='/state'){json(res,200,snapshot());return;}
    if(req.method!=='POST'){json(res,404,{error:'Не найдено'});return;}
    if(req.url==='/logs/export/close'){body(req).then(function(b){if(!b.url||b.url===logExport.view.url)return logExport.stop();}).then(function(){json(res,200,snapshot());},function(e){json(res,400,{error:e.message});});return;}
    if(busy){json(res,409,{error:'Дождитесь окончания текущей операции'});return;}busy=true;
    body(req).then(function(b){
        if(req.url==='/apps/refresh')return refreshApplications();
        if(req.url==='/settings'){
            if(b.appProxy!==undefined){if(Object.keys(b).length!==1)throw new Error('Сохраните маршрутизацию отдельно от других настроек');return updateAppProxy(b.appProxy);}
            if(b.ipFamily!==undefined){ipFamily.mode(b.ipFamily);if(phase==='connected'||phase==='connecting'||phase==='disconnecting')throw new Error('Сначала отключите соединение');}
            if(b.log!==undefined)Logging.preferences(b.log);
            if(b.language!==undefined&&!i18n.validPreference(b.language))throw new Error('Некорректный язык');
            if(b.autoConnect!==undefined&&typeof b.autoConnect!=='boolean')throw new Error('Некорректная настройка автоподключения');
            if(b.language!==undefined){state.settings.language=b.language;event('Язык интерфейса изменён','system','info',b.language);}
            if(b.ipFamily!==undefined){state.settings.ipFamily=b.ipFamily;cancelPings();selectedProbe={};serverPings=Object.create(null);event('Тип IP протокола сохранён','connection','info',b.ipFamily);}
            if(b.log!==undefined){var previousEnabled=state.settings.log.enabled,nextLog=Logging.preferences(b.log);if(previousEnabled&&!nextLog.enabled)event('Запись журнала выключена','system');state.settings.log=nextLog;eventLog.enabled=nextLog.enabled;if(nextLog.enabled)event(previousEnabled?'Настройки журнала обновлены':'Запись журнала включена','system');}
            if(b.autoConnect!==undefined){state.settings.autoConnect=b.autoConnect;state.autoPauseBootId='';autoConnect.reset();event(b.autoConnect?'Автоподключение включено':'Автоподключение выключено','connection');}
            save();return;
        }
        if(req.url==='/logs/export'){return logExport.start(events.slice(),{scope:b.scope,language:b.language,preferences:state.settings.log}).then(function(){event('Журнал подготовлен к экспорту','system');});}
        if(req.url==='/logs/clear'){eventLog.clear();return;}
        if(req.url==='/countries/refresh'){countries.refresh(state.servers,countryAddress,state.settings.ipFamily,state.selected);return;}
        if(req.url==='/probe')return probe();
        if(req.url==='/measure/all')return measureAll();
        if(req.url==='/measure'){var selectedProfile=state.servers.filter(function(p){return p.id===state.selected;})[0];if(!selectedProfile)throw new Error('Выберите сервер');if(phase==='connecting'||phase==='disconnecting')throw new Error('Дождитесь завершения подключения');if(phase==='connected')return connectionInfo.measure(root,ROOT,CORE,selectedProfile,state.mode==='socks',state.mode==='tv').then(function(info){peerInfo=info;logPing(info,selectedProfile.name);});selectedProbe={};return connectionInfo.probe(selectedProfile,null,state.settings.ipFamily).then(function(info){selectedProbe=info;logPing(info,selectedProfile.name);});}
        if(req.url==='/pair/start' || req.url==='/pair/remote'){if(b.protocol!==undefined&&['incy','happ','v2raytun'].indexOf(b.protocol)<0)throw new Error('Неизвестный формат QR');pairing.cancel();localPairing.cancel();happPairing.cancel();v2raytunPairing.cancel();pairProtocol=b.protocol||pairProtocol;return activePairing().start();}
        if(req.url==='/pair/local'){pairing.cancel();happPairing.cancel();v2raytunPairing.cancel();pairProtocol='incy';return localPairing.start();}
        if(req.url==='/pair/accept')return pairProtocol==='happ'?happPairing.accept():localPairing.accept();
        if(req.url==='/pair/cancel'){pairing.cancel();localPairing.cancel();happPairing.cancel(undefined,true);v2raytunPairing.cancel(undefined,true);return;}
        if(req.url==='/disconnect'){state.autoPauseBootId=bootId;state.connectionWantedBootId='';save();return disconnect();}
        if(req.url==='/connect'){var selectedServer=state.servers.filter(function(p){return p.id===b.id;})[0];if(!selectedServer)throw new Error('Сервер не найден');ipFamily.validate(selectedServer,state.settings.ipFamily);state.autoPauseBootId='';state.connectionWantedBootId=bootId;save();return autoConnect.manual(b.id);}
        if(req.url==='/select'){if(phase==='connected'||phase==='connecting')throw new Error('Сначала отключите соединение');if(!state.servers.some(function(p){return p.id===b.id;}))throw new Error('Сервер не найден');state.selected=b.id;selectedProbe={};save();event('Выбран сервер','servers','info',state.servers.filter(function(p){return p.id===b.id;})[0].name);return;}
        if(req.url==='/delete'){if(phase==='connected'||phase==='connecting')throw new Error('Сначала отключите соединение');cancelPings();delete serverPings[b.id];selectedProbe={};state.servers=state.servers.filter(function(p){return p.id!==b.id;});if(state.selected===b.id)state.selected=state.servers[0]?state.servers[0].id:null;save();event('Сервер удалён','servers');return;}
        if(req.url==='/import'){
            if(typeof b.text!=='string')throw new Error('Вставьте ссылку');
            return importText(b.text);
        }
        throw new Error('Неизвестная операция');
    }).then(function(){busy=false;json(res,200,snapshot());},function(e){busy=false;event('Операция не выполнена','system','error',redact(e.message));json(res,400,{error:redact(e.message).slice(0,350)});});
});
var AutoConnect=require('./auto-connect');
var autoConnect=new AutoConnect({get:function(){return {enabled:state.settings.autoConnect,wanted:state.connectionWantedBootId===bootId,paused:state.autoPauseBootId===bootId,phase:phase,busy:busy||probing,ready:ready,selected:state.servers.some(function(p){return p.id===state.selected;})?state.selected:null};},connect:function(id,attempt){state.connectionWantedBootId=bootId;save();busy=true;event(attempt.manual?'Ручное подключение: попытка '+attempt.attempt+' из 3':'Автоматическое подключение');return connect(id,'tv').then(function(){busy=false;},function(e){busy=false;throw e;});},exhausted:function(){state.autoPauseBootId=bootId;state.connectionWantedBootId='';save();lastError='Не удалось подключиться за 3 попытки';event(lastError,'connection','error');}});
var autoTimer=setInterval(function(){autoConnect.tick();},3000);if(autoTimer.unref)autoTimer.unref();
installation.listen(server,ROOT,TOKEN).catch(function(e){lastError=e.message;event(e.message,'system','error');});event('TIZY запущен.','system','info','0.14.4');
root(network.stop(ROOT,CORE)).then(probe,function(){lastError='Ожидаем доступ к службе root.';event(lastError,'system','warning');});
var readinessAttempts=0,readinessTimer=setInterval(function(){if(ready||probing||busy||phase==='connecting'||phase==='connected')return;if(!state.settings.autoConnect&&state.connectionWantedBootId!==bootId&&++readinessAttempts>40)return;probe();},15000);if(readinessTimer.unref)readinessTimer.unref();
function connectionLost(message,generation){
    if(generation!==connectionGeneration||phase!=='connected')return Promise.resolve();
    appMonitor.stop();connectionGeneration++;cancelPings();peerInfo={};trafficInfo={};connectedAt=0;phase='error';lastError=message;busy=true;autoConnect.lost();event(message,'connection','warning');
    try{write('lease','0');}catch(e){}
    return root(network.stop(ROOT,CORE)).catch(function(){}).then(function(){busy=false;});
}
function checkHealth(){
    if(phase!=='connected'||busy||checkingHealth)return;
    var generation=connectionGeneration;checkingHealth=true;
    root('( '+network.verifyPid(ROOT,CORE)+' ) && '+tvNetwork.verify()).then(function(){
        if(generation!==connectionGeneration||phase!=='connected'||Date.now()-lastHealthRequest<30000)return;
        lastHealthRequest=Date.now();
        return root('curl --connect-timeout 5 --max-time 10 --socks5-hostname 127.0.0.1:'+ports.socks+' -f -sS -o /dev/null -w "%{http_code}" https://www.gstatic.com/generate_204').then(function(code){
            if(generation!==connectionGeneration||phase!=='connected')return;
            if(code.trim()==='204'){event('Периодическая проверка VPN успешна','network','debug','HTTP 204');healthFailures=0;return;}event('Проверка VPN не пройдена','network','warning','HTTP '+code.trim());
            if(++healthFailures>=2)return connectionLost('Соединение прервано. Переподключаемся…',generation);
        },function(e){if(generation===connectionGeneration&&phase==='connected')event('Проверка VPN не пройдена','network','warning',redact(e.message));if(generation===connectionGeneration&&phase==='connected'&&++healthFailures>=2)return connectionLost('Соединение прервано. Переподключаемся…',generation);});
    },function(){event('Процесс VPN или правила сети недоступны','system','warning');return connectionLost('Соединение прервано. Переподключаемся…',generation);}).then(function(){checkingHealth=false;},function(){checkingHealth=false;});
}
var healthTimer=setInterval(function(){if(phase==='connected'||phase==='connecting'){try{lease();}catch(e){lastError='Не удалось продлить работу соединения';}}checkHealth();},5000);if(healthTimer.unref)healthTimer.unref();
var peerTimer=setInterval(function(){if(phase!=='connected'||busy||measuringPeer)return;var generation=connectionGeneration,p=state.servers.filter(function(s){return s.id===state.selected;})[0];if(!p)return;measuringPeer=true;connectionInfo.measure(root,ROOT,CORE,p,state.mode==='socks',state.mode==='tv').then(function(info){if(generation===connectionGeneration&&phase==='connected'&&info.serverIP)peerInfo=info;measuringPeer=false;},function(){measuringPeer=false;});},30000);if(peerTimer.unref)peerTimer.unref();
var lastTrafficLog=0;
function readTraffic(){if(phase!=='connected'||measuringTraffic)return;var generation=connectionGeneration;measuringTraffic=true;root(traffic.command(CORE)).then(function(text){if(generation===connectionGeneration&&phase==='connected'){trafficInfo=traffic.sample(traffic.parse(text),trafficInfo.measuredAt?trafficInfo:null,Date.now());if(typeof trafficInfo.downloadBps==='number'&&Date.now()-lastTrafficLog>=60000){lastTrafficLog=Date.now();event('Скорость VPN','network','debug','↑ '+Math.round(trafficInfo.uploadBps||0)+' B/s · ↓ '+Math.round(trafficInfo.downloadBps)+' B/s');}}},function(){if(generation===connectionGeneration)trafficInfo={};}).then(function(){measuringTraffic=false;},function(){if(generation===connectionGeneration)trafficInfo={};measuringTraffic=false;});}
var trafficTimer=setInterval(function(){if(!busy)readTraffic();},6000);if(trafficTimer.unref)trafficTimer.unref();
function stop(){appMonitor.stop();countries.close();logExport.stop();clearInterval(healthTimer);clearInterval(autoTimer);pairing.cancel();localPairing.cancel();happPairing.cancel();v2raytunPairing.cancel();clearInterval(readinessTimer);clearInterval(peerTimer);clearInterval(trafficTimer);try{write('lease','0');}catch(e){}server.close();root(network.stop(ROOT,CORE)).then(function(){vetro.close();process.exit(0);},function(){vetro.close();process.exit(1);});setTimeout(function(){process.exit(0);},5000);}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
