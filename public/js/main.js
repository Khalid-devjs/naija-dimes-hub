/* Naija Dimes Hub — front-end interactions */
(function () {
  'use strict';

  // hide loader
  window.addEventListener('load', function () {
    var l = document.getElementById('loader');
    if (l) setTimeout(function () { l.classList.add('hide'); }, 350);
  });

  // navbar toggle
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () { links.classList.toggle('open'); });
  }

  // FAQ accordion
  document.querySelectorAll('.faq-q').forEach(function (q) {
    q.addEventListener('click', function () {
      var item = q.parentElement;
      item.classList.toggle('open');
    });
  });

  // copy buttons
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var val = btn.getAttribute('data-copy');
      var done = function () {
        var old = btn.textContent;
        btn.textContent = '✓ Copied!';
        setTimeout(function () { btn.textContent = old; }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(val).then(done).catch(function () { fallbackCopy(val, done); });
      } else { fallbackCopy(val, done); }
    });
  });
  function fallbackCopy(text, done) {
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    document.body.removeChild(ta);
  }

  // toast helper
  window.toast = function (msg, type) {
    type = type || 'ok';
    var t = document.createElement('div');
    t.className = 'toast toast-' + type;
    t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 400); }, 2800);
  };

  // payment screenshot preview
  var shot = document.getElementById('screenshot');
  if (shot) {
    shot.addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      if (!/^image\//.test(file.type)) { window.toast('Only image files allowed', 'err'); this.value = ''; return; }
      var reader = new FileReader();
      reader.onload = function (ev) {
        var prev = document.getElementById('preview');
        if (prev) prev.innerHTML = '<img src="' + ev.target.result + '" class="img-preview" alt="Preview">';
      };
      reader.readAsDataURL(file);
    });
  }

  // countdown timers (elements with data-countdown="epochSeconds")
  document.querySelectorAll('[data-countdown]').forEach(function (el) {
    var end = parseInt(el.getAttribute('data-countdown'), 10) * 1000;
    var tick = function () {
      var d = end - Date.now();
      if (d <= 0) { el.textContent = 'Offer ended'; return; }
      var h = Math.floor(d / 3600000), m = Math.floor(d % 3600000 / 60000), s = Math.floor(d % 60000 / 1000);
      el.textContent = (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    };
    tick(); setInterval(tick, 1000);
  });
})();
