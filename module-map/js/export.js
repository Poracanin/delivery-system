/* ============================================================
   Export sítě — PNG, PDF (vlastní generátor), JSON
   Bez externích závislostí.
   ============================================================ */

const MMExport = (() => {

  const BG = '#EFE9E2';
  const DOT = '#DDD5C9';

  /**
   * Vytvoří samostatné SVG s obsahem sítě, ořezané na obsah
   * (uzly + popisky vazeb) s vnitřním okrajem.
   */
  function buildExportSvg(liveSvg, bbox, padding = 70) {
    const w = Math.max(1, Math.ceil(bbox.width + padding * 2));
    const h = Math.max(1, Math.ceil(bbox.height + padding * 2));

    const svg = liveSvg.cloneNode(true);
    svg.removeAttribute('style');
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    svg.setAttribute('viewBox', `${bbox.x - padding} ${bbox.y - padding} ${w} ${h}`);
    svg.setAttribute('font-family',
      "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif");

    // Dočasné vrstvy (rozpracovaná vazba) a porty pro tažení pryč —
    // v aplikaci je skrývá CSS, které se do exportu nepřenáší
    svg.querySelectorAll('[data-temp], .port').forEach(el => el.remove());

    // Viewport bez transformace — exportujeme ve world souřadnicích
    const vp = svg.querySelector('#viewport');
    if (vp) vp.removeAttribute('transform');

    // Pozadí: krémová plocha + jemné tečky, jako v aplikaci
    const ns = 'http://www.w3.org/2000/svg';
    let defs = svg.querySelector('defs');
    if (!defs) { defs = document.createElementNS(ns, 'defs'); svg.prepend(defs); }

    const pat = document.createElementNS(ns, 'pattern');
    pat.setAttribute('id', 'export-dots');
    pat.setAttribute('width', '26');
    pat.setAttribute('height', '26');
    pat.setAttribute('patternUnits', 'userSpaceOnUse');
    const dot = document.createElementNS(ns, 'circle');
    dot.setAttribute('cx', '13'); dot.setAttribute('cy', '13');
    dot.setAttribute('r', '1.3'); dot.setAttribute('fill', DOT);
    pat.appendChild(dot);
    defs.appendChild(pat);

    const mkRect = (fill) => {
      const r = document.createElementNS(ns, 'rect');
      r.setAttribute('x', bbox.x - padding);
      r.setAttribute('y', bbox.y - padding);
      r.setAttribute('width', w);
      r.setAttribute('height', h);
      r.setAttribute('fill', fill);
      return r;
    };
    svg.insertBefore(mkRect('url(#export-dots)'), defs.nextSibling);
    svg.insertBefore(mkRect(BG), defs.nextSibling);

    return { svg, w, h };
  }

  /** Vyrenderuje SVG do <canvas> (2× měřítko pro ostrost). */
  function svgToCanvas(svg, w, h, scale = 2) {
    return new Promise((resolve, reject) => {
      const xml = new XMLSerializer().serializeToString(svg);
      const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w * scale);
        canvas.height = Math.round(h * scale);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = BG;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas);
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Render SVG selhal')); };
      img.src = url;
    });
  }

  function download(blob, filename) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  async function exportPNG(liveSvg, bbox, filename = 'mapa-modulu.png') {
    const { svg, w, h } = buildExportSvg(liveSvg, bbox);
    const canvas = await svgToCanvas(svg, w, h, 2);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    download(blob, filename);
  }

  /* ----------------------------------------------------------
     Minimální PDF: jedna stránka s vloženým JPEG (DCTDecode)
     ---------------------------------------------------------- */
  function buildPdf(jpegBytes, imgW, imgH) {
    // px → pt (1 px = 0.75 pt), stránka přesně na míru obrázku
    const wPt = +(imgW * 0.75 / 2).toFixed(2); // /2 kvůli 2× renderu
    const hPt = +(imgH * 0.75 / 2).toFixed(2);

    const enc = new TextEncoder();
    const parts = [];
    const offsets = {};
    let offset = 0;

    const push = (data) => {
      const bytes = typeof data === 'string' ? enc.encode(data) : data;
      parts.push(bytes);
      offset += bytes.length;
    };

    push('%PDF-1.4\n%âãÏÓ\n');

    offsets[1] = offset;
    push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

    offsets[2] = offset;
    push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

    offsets[3] = offset;
    push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] ` +
         `/Resources << /XObject << /Im1 5 0 R >> /ProcSet [/PDF /ImageC] >> ` +
         `/Contents 4 0 R >>\nendobj\n`);

    const content = `q\n${wPt} 0 0 ${hPt} 0 0 cm\n/Im1 Do\nQ\n`;
    offsets[4] = offset;
    push(`4 0 obj\n<< /Length ${content.length} >>\nstream\n${content}endstream\nendobj\n`);

    offsets[5] = offset;
    push(`5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} ` +
         `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
         `/Length ${jpegBytes.length} >>\nstream\n`);
    push(jpegBytes);
    push('\nendstream\nendobj\n');

    const xrefStart = offset;
    let xref = 'xref\n0 6\n0000000000 65535 f \n';
    for (let i = 1; i <= 5; i++) {
      xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    }
    push(xref + `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`);

    return new Blob(parts, { type: 'application/pdf' });
  }

  async function exportPDF(liveSvg, bbox, filename = 'mapa-modulu.pdf') {
    const { svg, w, h } = buildExportSvg(liveSvg, bbox);
    const canvas = await svgToCanvas(svg, w, h, 2);
    const jpegBlob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.92));
    const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
    const pdf = buildPdf(jpegBytes, canvas.width, canvas.height);
    download(pdf, filename);
  }

  function exportJSON(state, filename = 'mapa-modulu.json') {
    const data = { app: 'module-map', version: 1, exportedAt: new Date().toISOString(), ...state };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    download(blob, filename);
  }

  return { exportPNG, exportPDF, exportJSON };
})();
