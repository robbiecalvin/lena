(function () {
  'use strict';

  var PASSWORD_HASH_SHA256 = '34426ea38e29dbdf2a0c24c1e5973ae4530e656861567a87a84e350fa25cc3b4';
  var SESSION_KEY = 'wqpsp_lena_unlocked';
  var SAVED_LOGO_KEY = 'wqpsp_lena_logo_data_url';
  var SAVED_WATERMARK_KEY = 'wqpsp_lena_watermark_data_url';
  var PRESET_LOGO_URL = './assets/images/company-logo.png';
  var PRESET_WATERMARK_URL = './assets/images/watermark.png';

  var loginCard = document.getElementById('loginCard');
  var appCard = document.getElementById('appCard');
  var loginForm = document.getElementById('loginForm');
  var passwordInput = document.getElementById('passwordInput');
  var loginError = document.getElementById('loginError');

  var processorForm = document.getElementById('processorForm');
  var presetLogoInput = document.getElementById('presetLogoInput');
  var presetWatermarkInput = document.getElementById('presetWatermarkInput');
  var savePresetsButton = document.getElementById('savePresetsButton');
  var photosInput = document.getElementById('photosInput');
  var namesInput = document.getElementById('namesInput');
  var processButton = document.getElementById('processButton');
  var statusText = document.getElementById('statusText');

  var presetLogo = null;
  var presetWatermark = null;
  var presetLogoSource = '';
  var presetWatermarkSource = '';

  if (sessionStorage.getItem(SESSION_KEY) === '1') {
    showApp();
  }

  loginForm.addEventListener('submit', function (event) {
    event.preventDefault();
    unlock();
  });

  photosInput.addEventListener('change', function (event) {
    var files = event.target.files;
    if (!files || !files.length || namesInput.value.trim() !== '') {
      return;
    }

    var names = [];
    for (var i = 0; i < files.length; i += 1) {
      names.push(stripExtension(files[i].name));
    }
    namesInput.value = names.join('\n');
  });

  processorForm.addEventListener('submit', function (event) {
    event.preventDefault();
    processBatch();
  });

  savePresetsButton.addEventListener('click', function () {
    savePresetAssets();
  });

  function showApp() {
    loginCard.classList.add('hidden');
    appCard.classList.remove('hidden');
  }

  async function unlock() {
    loginError.textContent = '';
    var pwd = passwordInput.value || '';
    if (!pwd) {
      loginError.textContent = 'Password is required.';
      return;
    }

    var hash = await sha256Hex(pwd);
    if (hash !== PASSWORD_HASH_SHA256) {
      loginError.textContent = 'Incorrect password.';
      return;
    }

    sessionStorage.setItem(SESSION_KEY, '1');
    passwordInput.value = '';
    showApp();
  }

  async function processBatch() {
    statusText.textContent = '';

    var files = photosInput.files;
    if (!files || files.length === 0) {
      statusText.textContent = 'Please upload at least one photo.';
      return;
    }

    var names = namesInput.value
      .split(/\r\n|\r|\n/g)
      .map(function (v) {
        return v.trim();
      })
      .filter(function (v) {
        return v.length > 0;
      });

    if (names.length !== files.length) {
      statusText.textContent = 'You need one strain name per uploaded photo.';
      return;
    }

    processButton.disabled = true;

    try {
      await ensureAssetsLoaded();
      await document.fonts.load('800 32px "Montserrat ExtraBold"');

      var zip = new JSZip();
      for (var i = 0; i < files.length; i += 1) {
        var safeName = sanitizeFileName(names[i]);
        if (!safeName) {
          safeName = 'strain-' + String(i + 1);
        }

        statusText.textContent = 'Processing ' + String(i + 1) + ' of ' + String(files.length) + '...';

        var result = await processOneImage(files[i], names[i]);
        var extension = result.extension;
        var unique = uniqueZipName(zip, safeName + '.' + extension);

        zip.file(unique, result.blob);
      }

      statusText.textContent = 'Building ZIP...';
      var zipBlob = await zip.generateAsync({ type: 'blob' });
      triggerDownload(zipBlob, 'lena-processed-photos.zip');
      statusText.textContent = 'Done. ZIP downloaded.';
    } catch (error) {
      statusText.textContent = error && error.message ? error.message : 'Processing failed.';
    } finally {
      processButton.disabled = false;
    }
  }

  async function ensureAssetsLoaded() {
    loadPresetSources();

    if (!presetLogo) {
      presetLogo = await loadImage(presetLogoSource);
    }

    if (!presetWatermark) {
      presetWatermark = await loadImage(presetWatermarkSource);
    }
  }

  async function savePresetAssets() {
    try {
      if (!presetLogoInput.files.length && !presetWatermarkInput.files.length) {
        statusText.textContent = 'Select a logo and/or watermark file first.';
        return;
      }

      if (presetLogoInput.files.length) {
        var logoDataUrl = await fileToDataUrl(presetLogoInput.files[0]);
        localStorage.setItem(SAVED_LOGO_KEY, logoDataUrl);
      }

      if (presetWatermarkInput.files.length) {
        var watermarkDataUrl = await fileToDataUrl(presetWatermarkInput.files[0]);
        localStorage.setItem(SAVED_WATERMARK_KEY, watermarkDataUrl);
      }

      presetLogo = null;
      presetWatermark = null;
      loadPresetSources();
      await ensureAssetsLoaded();

      presetLogoInput.value = '';
      presetWatermarkInput.value = '';
      statusText.textContent = 'Preset assets saved to this browser.';
    } catch (error) {
      statusText.textContent = error && error.message ? error.message : 'Could not save preset assets.';
    }
  }

  async function processOneImage(file, strainName) {
    var baseImage = await loadImageFromFile(file);
    var canvas = document.createElement('canvas');
    canvas.width = baseImage.width;
    canvas.height = baseImage.height;

    var ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas context could not be created.');
    }

    ctx.drawImage(baseImage, 0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.drawImage(presetWatermark, 0, 0, canvas.width, canvas.height);
    ctx.restore();

    var margin = Math.max(16, Math.round(canvas.width * 0.02));

    var logoWidth = Math.max(60, Math.round(canvas.width * 0.5));
    var logoHeight = Math.max(40, Math.round(logoWidth * (presetLogo.height / Math.max(presetLogo.width, 1))));

    var maxLogoHeight = Math.round(canvas.height * 0.35);
    if (logoHeight > maxLogoHeight) {
      logoHeight = maxLogoHeight;
      logoWidth = Math.max(60, Math.round(logoHeight * (presetLogo.width / Math.max(presetLogo.height, 1))));
    }

    var logoX = Math.max(margin, canvas.width - logoWidth - margin);
    var logoY = Math.max(margin, canvas.height - logoHeight - margin);
    ctx.drawImage(presetLogo, logoX, logoY, logoWidth, logoHeight);

    var label = String(strainName || '').toUpperCase();
    var fontSize = Math.min(68, Math.max(20, Math.round(canvas.width * 0.045)));
    ctx.font = '800 ' + String(fontSize) + 'px "Montserrat ExtraBold", sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#000000';
    ctx.fillText(label, margin, margin);

    var sourceType = file.type || '';
    var outputType = sourceType === 'image/png' ? 'image/png' : 'image/jpeg';
    var extension = outputType === 'image/png' ? 'png' : 'jpg';

    var blob = await canvasToBlob(canvas, outputType, 0.92);
    return { blob: blob, extension: extension };
  }

  function uniqueZipName(zip, fileName) {
    if (!zip.files[fileName]) {
      return fileName;
    }

    var dot = fileName.lastIndexOf('.');
    var name = dot > -1 ? fileName.slice(0, dot) : fileName;
    var ext = dot > -1 ? fileName.slice(dot) : '';

    var counter = 2;
    var candidate = '';
    while (true) {
      candidate = name + '-' + String(counter) + ext;
      if (!zip.files[candidate]) {
        return candidate;
      }
      counter += 1;
    }
  }

  function triggerDownload(blob, fileName) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();

    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function stripExtension(fileName) {
    return fileName.replace(/\.[^/.]+$/, '');
  }

  function sanitizeFileName(name) {
    return name
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase();
  }

  async function sha256Hex(value) {
    var bytes = new TextEncoder().encode(value);
    var digest = await crypto.subtle.digest('SHA-256', bytes);
    var arr = Array.from(new Uint8Array(digest));
    return arr.map(function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.onerror = function () {
        reject(new Error('Missing preset asset: ' + url + '. Add the file to the repository before use.'));
      };
      img.src = url;
    });
  }

  function loadImageFromFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        var img = new Image();
        img.onload = function () {
          resolve(img);
        };
        img.onerror = function () {
          reject(new Error('Could not read one uploaded image.'));
        };
        img.src = String(reader.result || '');
      };
      reader.onerror = function () {
        reject(new Error('Could not read one uploaded image.'));
      };
      reader.readAsDataURL(file);
    });
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (!blob) {
          reject(new Error('Could not export processed image.'));
          return;
        }
        resolve(blob);
      }, type, quality);
    });
  }

  function loadPresetSources() {
    var savedLogo = localStorage.getItem(SAVED_LOGO_KEY);
    var savedWatermark = localStorage.getItem(SAVED_WATERMARK_KEY);
    presetLogoSource = savedLogo || PRESET_LOGO_URL;
    presetWatermarkSource = savedWatermark || PRESET_WATERMARK_URL;
  }

  function fileToDataUrl(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ''));
      };
      reader.onerror = function () {
        reject(new Error('Could not read selected preset asset.'));
      };
      reader.readAsDataURL(file);
    });
  }
})();
