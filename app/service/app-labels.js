'use strict';
// Labels only: package IDs and routing boundaries must stay unchanged.
var names={
 'org.tizen.browser':['Samsung Browser','Браузер Samsung','Samsung Tarayıcı','三星浏览器'],
 'com.samsung.tv.knox-browser':['Samsung Knox Browser','Браузер Samsung Knox','Samsung Knox Tarayıcı','三星 Knox 浏览器'],
 'com.samsung.tv.store':['Samsung Apps Store','Магазин приложений Samsung','Samsung Uygulama Mağazası','三星应用商店'],
 'com.samsung.tv.adplayer':['Advertising Player','Воспроизведение рекламы','Reklam Oynatıcı','广告播放器'],
 'com.samsung.tv.aov-dashboard':['Samsung AOV Panel','Системная панель AOV','Samsung AOV Paneli','三星 AOV 面板'],
 'com.samsung.tizen.autofill-app':['Autofill','Автозаполнение','Otomatik Doldurma','自动填充'],
 'com.samsung.tv.bixbycapsuleviewer':['Bixby Viewer','Интерфейс Bixby','Bixby Arayüzü','Bixby 界面'],
 'com.samsung.tv.cnvoice':['Voice Service (CN Voice)','Голосовая служба (CN Voice)','Ses Hizmeti (CN Voice)','语音服务（CN Voice）'],
 'com.samsung.tv.cnvoice-assistant':['Voice Assistant (CN Voice)','Голосовой помощник (CN Voice)','Sesli Asistan (CN Voice)','语音助手（CN Voice）'],
 'com.samsung.tv.coba.samsungaccount':['Samsung Account (CoBA)','Учётная запись Samsung (CoBA)','Samsung Hesabı (CoBA)','三星账户（CoBA）'],
 'com.samsung.tv.coba.adagent':['Samsung Advertising Service (CoBA)','Рекламная служба Samsung (CoBA)','Samsung Reklam Hizmeti (CoBA)','三星广告服务（CoBA）'],
 'com.samsung.tv.searchall':['Samsung TV Search','Поиск по телевизору','Samsung TV Arama','三星电视搜索'],
 'com.samsung.tv.CSAccount':['Samsung Account (CSAccount)','Учётная запись Samsung (CSAccount)','Samsung Hesabı (CSAccount)','三星账户（CSAccount）'],
 'com.samsung.tv.CSBilling':['Samsung Payments','Платежи Samsung','Samsung Ödemeleri','三星支付'],
 'LzU5yAFXeg':['User Manual','Руководство пользователя','Kullanım Kılavuzu','用户手册'],
 'com.samsung.tv.gallery':['Samsung Gallery','Галерея Samsung','Samsung Galeri','三星相册'],
 'com.samsung.tv.google-assistant':['Google Assistant','Google Ассистент','Google Asistan','Google 助理'],
 'com.samsung.tv.intelligent-action-app':['Smart Actions','Интеллектуальные действия','Akıllı İşlemler','智能操作'],
 'com.samsung.tv.music-flex':['Samsung Music (Music Flex)','Музыка Samsung (Music Flex)','Samsung Müzik (Music Flex)','三星音乐（Music Flex）'],
 'com.samsung.tv.quickpanel':['Samsung Quick Panel','Быстрая панель Samsung','Samsung Hızlı Panel','三星快捷面板'],
 'com.samsung.tv.SAFCommonPlugin':['Samsung System Module (SAF)','Системный модуль Samsung (SAF)','Samsung Sistem Modülü (SAF)','三星系统模块（SAF）'],
 'yL49PNFmjW':['Samsung Promotions','Предложения Samsung','Samsung Kampanyaları','三星优惠'],
 'J9fZJDMi1v':['Security Center','Центр безопасности','Güvenlik Merkezi','安全中心'],
 'com.samsung.tv.aispeaker-oobe-app':['Soundbar Setup','Настройка саундбара','Soundbar Kurulumu','回音壁设置'],
 'org.tizen.voice-app':['Voice Assistant','Голосовой помощник','Sesli Asistan','语音助手'],
 'com.samsung.tv.voiceassistant-music':['Music Voice Control','Голосовое управление музыкой','Müzik İçin Sesli Kontrol','音乐语音控制'],
 'com.samsung.tv.mybixby':['Bixby Menu','Меню Bixby','Bixby Menüsü','Bixby 菜单'],
 'com.samsung.tv.weather-viewer':['Samsung Weather','Погода Samsung','Samsung Hava Durumu','三星天气']
};
function apply(item){var n=names[item.id];if(!n)return item;item.name=n[0];item.nameRu=n[1];item.labels={en:n[0],ru:n[1],tr:n[2],'zh-Hans':n[3]};return item;}
module.exports={apply:apply,names:names};
