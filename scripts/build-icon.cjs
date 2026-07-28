/* 生成应用图标：从统一品牌 SVG 标记栅格化为 assets/icon.png(512) 与 assets/icon.ico(多尺寸)。
 * 依赖：@resvg/resvg-js、png-to-ico（装在托管 Node 工作区，运行时用 NODE_PATH 指向）。
 */
const { Resvg } = require('@resvg/resvg-js');
const pngToIco = require('png-to-ico').default;
const fs = require('fs');
const path = require('path');

// 品牌标记：圆角渐变方底 + 半透明进度环 + 实心对勾（与侧边栏 logo 同源）
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4F63F5"/>
      <stop offset="55%" stop-color="#6A5BF2"/>
      <stop offset="100%" stop-color="#8A57E8"/>
    </linearGradient>
  </defs>
  <rect x="48" y="48" width="416" height="416" rx="104" fill="url(#bg)"/>
  <rect x="48" y="48" width="416" height="220" rx="104" fill="#FFFFFF" opacity="0.10"/>
  <g fill="none" stroke="#FFFFFF" stroke-width="30" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="256" cy="256" r="108" opacity="0.5"/>
    <path d="M210 258 L246 294 L312 220"/>
  </g>
</svg>`;

const outDir = path.join(__dirname, '..', 'assets');

(async () => {
  const sizes = [512, 256, 128, 64, 48, 32, 16];
  const pngs = {};
  for (const s of sizes) {
    const r = new Resvg(SVG, { fitTo: { mode: 'width', value: s } });
    pngs[s] = r.render().asPng();
  }
  fs.writeFileSync(path.join(outDir, 'icon.png'), pngs[512]);
  const ico = await pngToIco([pngs[256], pngs[128], pngs[64], pngs[48], pngs[32], pngs[16]]);
  fs.writeFileSync(path.join(outDir, 'icon.ico'), ico);
  console.log('OK ->', path.join(outDir, 'icon.png'), '|', path.join(outDir, 'icon.ico'));
})().catch((e) => {
  console.error('icon build failed:', e);
  process.exit(1);
});
