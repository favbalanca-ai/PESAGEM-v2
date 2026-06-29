// FAV NFA - Anúncio de identidade v5.9
// Roda APENAS na página do app (GitHub Pages) e avisa, via postMessage, qual é
// o ID desta extensão. O app guarda esse ID (localStorage fav_ext_id) e passa a
// achar a extensão sozinho — sem precisar configurar o ID na mão.
(function () {
  try {
    var msg = { __FAV_EXT__: true, id: chrome.runtime.id, version: '5.9' };
    // anuncia agora e responde quando o app pedir (PING)
    window.postMessage(msg, '*');
    window.addEventListener('message', function (e) {
      if (e.source === window && e.data && e.data.__FAV_EXT_PING__) {
        window.postMessage(msg, '*');
      }
    });
  } catch (e) { /* fora do contexto da extensão — ignora */ }
})();
