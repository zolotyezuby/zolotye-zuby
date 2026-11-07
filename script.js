// Золотые зубы.exe — предсказатель.
// Чтобы добавить цитаты, дописывайте строки в файл quotes.txt
// (UTF-8, одна цитата на строку; пустые строки пропускаются).
//
// Безопасность: весь текст выводится только через textContent,
// HTML из quotes.txt и из поля вопроса никогда не интерпретируется.
// Вопрос пользователя нигде не сохраняется и никуда не отправляется.

'use strict';

(function () {
  var STORAGE_KEY = 'muted';           // единственное, что хранится в localStorage
  var THINK_MS = 1200;                 // длительность анимации «думаю…»
  var FILE_NAME = 'zolotye-zuby-prediction.png';
  var ERROR_TEXT = 'Не удалось загрузить цитаты, попробуй обновить страницу';
  var PLACEHOLDER_TEXT = 'Здесь появится цитата Золотых зубов';
  var CANVAS_FONT = '"Courier New", "Lucida Console", "Liberation Mono", "DejaVu Sans Mono", "Nimbus Mono PS", monospace';
  var SIZE_CLASSES = ['size-xl', 'size-l', 'size-m', 'size-s', 'size-xs'];
  var STATE_CLASSES = ['is-placeholder', 'is-error', 'is-thinking'];

  function byId(id) {
    return document.getElementById(id);
  }

  var enterBtn = byId('enter');
  var soundBtn = byId('sound');
  var audio = byId('music');
  var form = byId('ask-form');
  var input = byId('question');
  var hint = byId('hint');
  var askBtn = byId('ask');
  var resultQuestion = byId('result-question');
  var resultText = byId('result-text');
  var resultSign = byId('result-sign');
  var downloadBtn = byId('download');
  var reaskBtn = byId('reask');
  var statusEl = byId('status');
  var photo = byId('photo');

  /* ================= localStorage (только флаг «звук выключен») ================= */

  function readMuted() {
    try {
      return window.localStorage.getItem(STORAGE_KEY) === '1';
    } catch (e) {
      return false; // хранилище запрещено — просто работаем без него
    }
  }

  function writeMuted(value) {
    try {
      if (value) {
        window.localStorage.setItem(STORAGE_KEY, '1');
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      /* хранилище недоступно — выбор действует до закрытия вкладки */
    }
  }

  /* ================= Музыка ================= */

  var muted = readMuted();
  var entered = false;

  function updateSoundButton() {
    soundBtn.textContent = muted ? '🔇' : '🔊';
    soundBtn.setAttribute('aria-label', muted ? 'Включить музыку' : 'Выключить музыку');
    soundBtn.title = muted ? 'Включить музыку' : 'Выключить музыку';
  }

  function playMusic() {
    if (!entered || muted || !audio) return;
    audio.loop = true;
    audio.volume = 0.5;
    try {
      var p = audio.play();
      if (p && typeof p.catch === 'function') {
        p.catch(function () { /* нет файла или браузер запретил — сайт работает дальше */ });
      }
    } catch (e) { /* игнорируем */ }
  }

  soundBtn.addEventListener('click', function () {
    muted = !muted;
    writeMuted(muted);
    if (muted) {
      if (audio) audio.pause();
    } else {
      playMusic();
    }
    updateSoundButton();
  });

  enterBtn.addEventListener('click', function () {
    entered = true;
    enterBtn.hidden = true;
    document.body.classList.remove('is-locked');
    playMusic();
  });

  updateSoundButton();
  enterBtn.focus();

  /* ================= Фото ================= */

  var img = photo ? photo.querySelector('img') : null;
  if (img) {
    var markMissing = function () { photo.classList.add('photo--missing'); };
    img.addEventListener('error', markMissing);
    if (img.complete && img.naturalWidth === 0) markMissing();
  }

  /* ================= Загрузка цитат из quotes.txt ================= */

  var quotesFailed = false;

  // Управляющие символы и символы смены направления текста убираем —
  // содержимое файла считаем недоверенным.
  var UNSAFE_CHARS = /[\u0000-\u0008\u000B-\u001F\u007F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g;

  var quotesPromise = fetch('quotes.txt', { cache: 'no-cache', credentials: 'same-origin' })
    .then(function (response) {
      if (!response.ok) throw new Error('HTTP ' + response.status);
      return response.text();
    })
    .then(function (text) {
      var list = text
        .replace(/^\uFEFF/, '')       // BOM в начале файла
        .split(/\r?\n/)
        .map(function (line) { return line.replace(UNSAFE_CHARS, '').trim(); })
        .filter(function (line) { return line.length > 0; });
      if (list.length === 0) throw new Error('quotes.txt пустой');
      return list;
    });

  quotesPromise.catch(function () {
    quotesFailed = true;
    // Показываем ошибку сразу, если пользователь ещё ничего не спросил
    if (resultText.classList.contains('is-placeholder')) showError();
  });

  /* ================= Отображение результата ================= */

  function setTextState(state) {
    STATE_CLASSES.concat(SIZE_CLASSES).forEach(function (c) { resultText.classList.remove(c); });
    if (state) resultText.classList.add(state);
  }

  function sizeClassFor(text) {
    var n = text.length;
    if (n <= 40) return 'size-xl';
    if (n <= 90) return 'size-l';
    if (n <= 160) return 'size-m';
    if (n <= 280) return 'size-s';
    return 'size-xs';
  }

  function showPlaceholder() {
    resultQuestion.hidden = true;
    resultQuestion.textContent = '';
    resultSign.hidden = true;
    setTextState('is-placeholder');
    resultText.textContent = PLACEHOLDER_TEXT;
  }

  function showError() {
    resultQuestion.hidden = true;
    resultSign.hidden = true;
    setTextState('is-error');
    resultText.textContent = ERROR_TEXT;
    statusEl.textContent = 'Ошибка загрузки цитат';
  }

  function showThinking() {
    resultQuestion.hidden = true;
    resultSign.hidden = true;
    setTextState('is-thinking');
    resultText.textContent = 'Думаю';
    statusEl.textContent = 'Думаю…';
  }

  function showPrediction(question, quote) {
    resultQuestion.textContent = 'Вопрос: ' + question;
    resultQuestion.hidden = false;
    setTextState(sizeClassFor(quote));
    resultText.textContent = quote;
    resultSign.hidden = false;
    statusEl.textContent = 'Предсказание получено';
  }

  function showHint(text) {
    hint.textContent = text;
  }

  /* ================= Логика вопроса ================= */

  var lastIndex = -1;
  var requestId = 0;          // помогает игнорировать устаревшие ответы после «Переспросить»
  var current = null;         // текущее предсказание (только в памяти страницы)

  function wait(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  function randomInt(max) {
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      var buf = new Uint32Array(1);
      window.crypto.getRandomValues(buf);
      return buf[0] % max;
    }
    return Math.floor(Math.random() * max);
  }

  function pickIndex(length) {
    if (length <= 1) return 0;
    var i;
    do {
      i = randomInt(length);
    } while (i === lastIndex);
    return i;
  }

  input.addEventListener('input', function () {
    if (hint.textContent) showHint('');
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault(); // никакой отправки на сервер

    var question = input.value.trim();
    if (!question) {
      showHint('Сначала напиши вопрос — хотя бы одно слово.');
      input.value = '';
      input.focus();
      return;
    }
    showHint('');

    var myId = ++requestId;
    current = null;
    askBtn.disabled = true;
    downloadBtn.disabled = true;
    showThinking();

    // Ждём и анимацию, и загрузку файла (если он ещё грузится)
    Promise.all([quotesPromise, wait(THINK_MS)])
      .then(function (values) {
        if (myId !== requestId) return;
        var list = values[0];
        var index = pickIndex(list.length);
        lastIndex = index;
        current = { question: question, quote: list[index] };
        showPrediction(question, list[index]);
        downloadBtn.disabled = false;
      })
      .catch(function () {
        if (myId !== requestId) return;
        showError();
      })
      .then(function () {
        if (myId === requestId) askBtn.disabled = false;
      });
  });

  reaskBtn.addEventListener('click', function () {
    requestId++;
    current = null;
    input.value = '';
    showHint('');
    askBtn.disabled = false;
    downloadBtn.disabled = true;
    if (quotesFailed) {
      showError();
    } else {
      showPlaceholder();
      statusEl.textContent = 'Готов к вопросам';
    }
    input.focus();
  });

  /* ================= Картинка предсказания (canvas 1080×1350) ================= */

  function fontsReady() {
    if (document.fonts && document.fonts.ready) {
      return document.fonts.ready.then(function () {}, function () {});
    }
    return Promise.resolve();
  }

  function setFont(ctx, size, bold) {
    ctx.font = (bold ? 'bold ' : '') + size + 'px ' + CANVAS_FONT;
  }

  // Разбивает слово по символам — только если оно не влезает в строку даже целиком
  function splitLongWord(ctx, word, maxWidth) {
    var parts = [];
    var chunk = '';
    Array.from(word).forEach(function (ch) {
      if (chunk && ctx.measureText(chunk + ch).width > maxWidth) {
        parts.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    });
    if (chunk) parts.push(chunk);
    return parts;
  }

  // Перенос по пробелам. Если allowBreak = false и слово не помещается, возвращает overflow = true.
  function wrapText(ctx, text, maxWidth, allowBreak) {
    var words = text.split(/\s+/).filter(Boolean);
    var lines = [];
    var line = '';
    var overflow = false;

    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      var test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width <= maxWidth) {
        line = test;
        continue;
      }
      if (line) lines.push(line);
      if (ctx.measureText(word).width > maxWidth) {
        if (!allowBreak) {
          overflow = true;
          line = word;
          continue;
        }
        var parts = splitLongWord(ctx, word, maxWidth);
        for (var j = 0; j < parts.length - 1; j++) lines.push(parts[j]);
        line = parts[parts.length - 1];
      } else {
        line = word;
      }
    }
    if (line) lines.push(line);
    return { lines: lines, overflow: overflow };
  }

  function ellipsize(ctx, line, maxWidth) {
    var chars = Array.from(line);
    while (chars.length && ctx.measureText(chars.join('') + '…').width > maxWidth) chars.pop();
    return chars.join('').replace(/\s+$/, '') + '…';
  }

  // Подбор размера шрифта: самый крупный, при котором текст влезает в рамку, а слова не рвутся
  function fitText(ctx, text, maxWidth, maxHeight, maxSize, minSize, lineHeight) {
    for (var size = maxSize; size >= minSize; size -= 2) {
      setFont(ctx, size, true);
      var r = wrapText(ctx, text, maxWidth, false);
      if (!r.overflow && r.lines.length * size * lineHeight <= maxHeight) {
        return { size: size, lines: r.lines };
      }
    }
    // Крайний случай (очень длинная строка): минимальный размер, лишнее обрезаем с «…»
    setFont(ctx, minSize, true);
    var lines = wrapText(ctx, text, maxWidth, true).lines;
    var maxLines = Math.max(1, Math.floor(maxHeight / (minSize * lineHeight)));
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      lines[maxLines - 1] = ellipsize(ctx, lines[maxLines - 1], maxWidth);
    }
    return { size: minSize, lines: lines };
  }

  // Фото с сайта (тот же photo.jpg). Ждём загрузки; если файла нет — картинка рисуется без фото.
  function loadPhoto() {
    if (!img || photo.classList.contains('photo--missing')) return Promise.resolve(null);
    if (img.complete) return Promise.resolve(img.naturalWidth > 0 ? img : null);
    return new Promise(function (resolve) {
      var finish = function () { resolve(img.complete && img.naturalWidth > 0 ? img : null); };
      img.addEventListener('load', finish, { once: true });
      img.addEventListener('error', finish, { once: true });
      setTimeout(finish, 5000);
    });
  }

  // Рисует фото «обложкой» (как object-fit: cover; object-position: center 30% в style.css)
  function drawCover(ctx, image, x, y, w, h) {
    var iw = image.naturalWidth;
    var ih = image.naturalHeight;
    var scale = Math.max(w / iw, h / ih);
    var sw = w / scale;
    var sh = h / scale;
    var sx = (iw - sw) / 2;
    var sy = (ih - sh) * 0.3;
    ctx.drawImage(image, sx, sy, sw, sh, x, y, w, h);
  }

  function renderPrediction(prediction, photoImg) {
    var W = 1080;
    var H = 1350;
    var canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    var ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas недоступен');

    var INK = '#111111';
    var ACCENT = '#c8005f';
    var MUTED = '#666666';

    // Фон с точечной сеткой, как на сайте
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#e2e2e2';
    for (var gx = 12; gx < W; gx += 30) {
      for (var gy = 12; gy < H; gy += 30) ctx.fillRect(gx, gy, 2, 2);
    }

    // Окно программы с жёсткой тенью
    var m = 64;
    var winX = m;
    var winY = m;
    var winW = W - m * 2 - 14;
    var winH = H - m * 2 - 14;
    ctx.fillStyle = INK;
    ctx.fillRect(winX + 14, winY + 14, winW, winH);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(winX, winY, winW, winH);
    ctx.lineWidth = 4;
    ctx.strokeStyle = INK;
    ctx.strokeRect(winX + 2, winY + 2, winW - 4, winH - 4);

    // Заголовок окна
    var barH = 72;
    ctx.fillStyle = INK;
    ctx.fillRect(winX, winY, winW, barH);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';
    setFont(ctx, 28, true);
    var title = '✦ Золотые зубы.exe — предсказатель';
    var titleMax = winW - 200;
    if (ctx.measureText(title).width > titleMax) title = ellipsize(ctx, title, titleMax);
    ctx.fillText(title, winX + 24, winY + barH / 2);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    setFont(ctx, 22, true);
    ctx.textAlign = 'center';
    ['_', '□', '×'].forEach(function (sym, i) {
      var bx = winX + winW - 24 - (3 - i) * 46 + 6;
      ctx.strokeRect(bx, winY + 18, 36, 36);
      ctx.fillText(sym, bx + 18, winY + 36);
    });

    // Фото под заголовком окна — на всю ширину окна
    var photoH = 0;
    if (photoImg) {
      photoH = 440;
      drawCover(ctx, photoImg, winX + 4, winY + barH, winW - 8, photoH);
      ctx.fillStyle = INK;
      ctx.fillRect(winX, winY + barH + photoH, winW, 4);
      photoH += 4;
    }

    var padX = 64;
    var x = winX + padX;
    var maxW = winW - padX * 2;
    var y = winY + barH + photoH + (photoImg ? 56 : 64);

    // Метка
    ctx.textAlign = 'left';
    ctx.fillStyle = ACCENT;
    setFont(ctx, 24, true);
    ctx.fillText('ПРЕДСКАЗАНИЕ ОТ ЗОЛОТЫХ ЗУБОВ', x, y);
    y += 56;

    // Вопрос (мелко: с фото до 2 строк, без фото до 4)
    ctx.fillStyle = MUTED;
    setFont(ctx, 28, false);
    var qLines = wrapText(ctx, 'Вопрос: ' + prediction.question, maxW, true).lines;
    var qMax = photoImg ? 2 : 4;
    if (qLines.length > qMax) {
      qLines = qLines.slice(0, qMax);
      qLines[qMax - 1] = ellipsize(ctx, qLines[qMax - 1], maxW);
    }
    qLines.forEach(function (line) {
      ctx.fillText(line, x, y);
      y += 38;
    });
    y += 18;

    // Разделитель
    ctx.fillStyle = INK;
    ctx.fillRect(x, y, maxW, 3);
    y += 40;

    // Подпись внизу
    var signY = winY + winH - 70;
    ctx.fillRect(x, signY - 50, maxW, 3);
    ctx.fillStyle = INK;
    setFont(ctx, 26, true);
    ctx.fillText('Золотые зубы • Предсказание 2026', x, signY);

    // Цитата (крупно, с переносом и автоподбором размера), по центру по вертикали
    var areaTop = y;
    var areaBottom = signY - 90;
    var LH = 1.3;
    var fit = fitText(ctx, prediction.quote, maxW, areaBottom - areaTop, photoImg ? 80 : 92, 26, LH);
    var lineStep = fit.size * LH;
    var blockH = fit.lines.length * lineStep;
    var startY = areaTop + Math.max(0, (areaBottom - areaTop - blockH) / 2);
    setFont(ctx, fit.size, true);
    ctx.fillStyle = INK;
    fit.lines.forEach(function (line, i) {
      ctx.fillText(line, x, startY + i * lineStep + lineStep / 2);
    });

    return canvas;
  }

  function canvasToBlob(canvas) {
    return new Promise(function (resolve, reject) {
      if (!canvas.toBlob) {
        reject(new Error('toBlob не поддерживается'));
        return;
      }
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob); else reject(new Error('пустой blob'));
      }, 'image/png');
    });
  }

  function isIOS() {
    var ua = navigator.userAgent || '';
    return /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function saveBlob(blob, tab) {
    var url = URL.createObjectURL(blob);
    if (tab && !tab.closed) {
      // iPhone: открываем картинку в новой вкладке — там её можно сохранить долгим нажатием
      tab.location.href = url;
    } else {
      var a = document.createElement('a');
      a.href = url;
      a.download = FILE_NAME;
      a.rel = 'noopener';
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  downloadBtn.addEventListener('click', function () {
    if (!current) return;
    var prediction = current;

    // Вкладку на iPhone открываем сразу в обработчике клика, иначе её заблокирует браузер
    var tab = null;
    if (isIOS()) {
      tab = window.open('', '_blank');
      if (tab) tab.opener = null;
    }

    downloadBtn.disabled = true;
    fontsReady()
      .then(loadPhoto)
      .then(function (photoImg) {
        // Если с фото что-то не так (например, canvas «испорчен»), делаем картинку без фото
        return canvasToBlob(renderPrediction(prediction, photoImg)).catch(function () {
          return canvasToBlob(renderPrediction(prediction, null));
        });
      })
      .then(function (blob) {
        saveBlob(blob, tab);
        statusEl.textContent = 'Картинка готова';
      })
      .catch(function () {
        if (tab && !tab.closed) tab.close();
        statusEl.textContent = 'Не удалось создать картинку';
      })
      .then(function () {
        downloadBtn.disabled = !current;
      });
  });
})();
