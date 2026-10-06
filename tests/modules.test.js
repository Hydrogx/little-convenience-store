/**
 * 模块完整性测试：
 * 1. 每个相对 import 都能找到真实文件（子目录里最容易写错路径）；
 * 2. 每个文件都能被 node 成功解析（语法错误会立刻暴露）；
 * 3. 静态资源（样式、图标、商品插画）都在磁盘上存在。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));

function walk(dir, result = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, result);
    else result.push(full);
  }
  return result;
}

const jsFiles = walk(join(ROOT, 'src')).filter((file) => file.endsWith('.js'));
const testFiles = walk(join(ROOT, 'tests')).filter((file) => file.endsWith('.js'));

test('src 下有足够多的模块（不是把代码堆在一个文件里）', () => {
  assert.ok(jsFiles.length >= 20, `src 下只有 ${jsFiles.length} 个 js 文件`);
});

test('每个相对 import 都指向真实存在的文件', () => {
  const problems = [];
  for (const file of [...jsFiles, ...testFiles]) {
    const source = readFileSync(file, 'utf8');
    const importPattern = /(?:^|\n)\s*(?:import|export)[^'"\n]*?from\s+['"]([^'"]+)['"]/g;
    for (const match of source.matchAll(importPattern)) {
      const specifier = match[1];
      if (!specifier.startsWith('.')) continue; // 只检查相对路径，node: 内置模块跳过
      const target = resolve(dirname(file), specifier);
      if (!existsSync(target)) {
        problems.push(`${relative(ROOT, file)} → ${specifier}`);
      }
    }
  }
  assert.deepEqual(problems, [], `有 ${problems.length} 个 import 指向了不存在的文件`);
});

test('每个模块都能被 node 成功加载（没有语法错误、没有循环依赖报错）', async () => {
  for (const file of jsFiles) {
    // 界面模块和入口需要 DOM，改由 tools/browser-check.mjs 在真实浏览器里验证
    if (file.includes(`${join('src', 'ui')}`) || file.endsWith(`${join('src', 'main.js')}`)) continue;
    await assert.doesNotReject(() => import(pathToFileURL(file).href), `无法加载 ${relative(ROOT, file)}`);
  }
});

test('HTML 里引用的样式、脚本和图标都存在', () => {
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const references = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
  assert.ok(references.length >= 6, 'HTML 应该分开引用样式、脚本和图标');
  for (const reference of references) {
    if (reference.startsWith('http') || reference.startsWith('#')) continue;
    assert.ok(existsSync(join(ROOT, reference)), `index.html 引用了不存在的文件 ${reference}`);
  }
});

test('每种商品都有对应的 SVG 插画文件', async () => {
  const { PRODUCTS } = await import('../src/data/products.js');
  for (const product of PRODUCTS) {
    const asset = join(ROOT, 'assets', 'products', `${product.id}.svg`);
    assert.ok(existsSync(asset), `缺少商品插画 assets/products/${product.id}.svg`);
    const svg = readFileSync(asset, 'utf8');
    assert.ok(svg.startsWith('<svg'), `${product.id}.svg 不是 SVG 文件`);
    assert.ok(svg.includes('viewBox'), `${product.id}.svg 缺少 viewBox`);
  }
});

test('商品插画使用的颜色和商品数据里的主颜色一致', async () => {
  const { PRODUCTS } = await import('../src/data/products.js');
  const { COLORS } = await import('../src/data/colors.js');
  for (const product of PRODUCTS) {
    const svg = readFileSync(join(ROOT, 'assets', 'products', `${product.id}.svg`), 'utf8').toLowerCase();
    const hex = COLORS[product.color].hex.toLowerCase();
    assert.ok(svg.includes(hex), `${product.id}.svg 里没有出现主颜色 ${hex}`);
  }
});
