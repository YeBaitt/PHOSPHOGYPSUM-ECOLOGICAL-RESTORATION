import { getSite, getStageData } from '../data/siteData.js';

const stageLabels = {
  pit: '原始基坑',
  liner: '基坑整理与防渗',
  stack: '磷石膏堆填',
  cover: '封场覆土',
  restoration: '植物修复',
};

const basicLabels = {
  location: '地理位置',
  capacity: '库容',
  sourceType: '磷石膏来源',
  operationStatus: '运行状态',
  commissioned: '投运时间',
  riverDistance: '距长江支流',
};

export function formatValue(value, unit = '') {
  if (value === null || value === undefined || value === '') {
    return '暂无数据';
  }
  return unit ? `${value} ${unit}` : String(value);
}

function renderBasics(site) {
  return Object.entries(basicLabels)
    .map(([key, label]) => `
      <div class="basic-row">
        <span>${label}</span>
        <strong>${site.basics[key]}</strong>
      </div>
    `)
    .join('');
}

function renderMeasurements(stage, state) {
  if (!stage.groups.length) {
    return '<div class="empty-data"><span>—</span><strong>暂无数据</strong><small>报告未记录该阶段的明确数值</small></div>';
  }

  const groupIndex = Math.min(state.activeGroup, stage.groups.length - 1);
  const group = stage.groups[groupIndex];
  const sampleIndex = Math.min(state.activeSample, group.samples.length - 1);
  const sample = group.samples[sampleIndex];

  const groupTabs = stage.groups
    .map((item, index) => `
      <button data-group="${index}" class="data-tab ${index === groupIndex ? 'is-active' : ''}">
        ${item.label}
      </button>
    `)
    .join('');

  const sampleTabs = group.samples
    .map((item, index) => `
      <button data-sample="${index}" class="sample-tab ${index === sampleIndex ? 'is-active' : ''}">
        ${item.name}
      </button>
    `)
    .join('');

  const metrics = Object.entries(sample.values)
    .map(([key, value]) => `
      <div class="metric">
        <span>${group.labels[key]}</span>
        <strong>${formatValue(value, group.units[key])}</strong>
      </div>
    `)
    .join('');

  return `
    <div class="data-tabs">${groupTabs}</div>
    <div class="sample-tabs">${sampleTabs}</div>
    <div class="sample-name">当前样品：${sample.name}</div>
    <div class="metric-grid">${metrics}</div>
    <div class="data-source">数据来源：${group.source}</div>
  `;
}

function renderSiteButtons(currentSite) {
  return ['sanbanhu', 'dongxiquan']
    .map((siteId) => `
      <button data-site="${siteId}" class="${siteId === currentSite ? 'is-active' : ''}">
        ${getSite(siteId).name}
      </button>
    `)
    .join('');
}

function renderStageButtons(currentStage) {
  return Object.entries(stageLabels)
    .map(([stageId, label], index) => `
      <button data-stage="${stageId}" class="${stageId === currentStage ? 'is-active' : ''}">
        <span>0${index + 1}</span>
        <strong>${label}</strong>
      </button>
    `)
    .join('');
}

export function renderDashboard(root, state) {
  const site = getSite(state.currentSite);
  const stage = getStageData(state.currentSite, state.currentStage);
  const canvas = root.querySelector('#scene-canvas') || document.createElement('canvas');
  canvas.id = 'scene-canvas';
  canvas.setAttribute('aria-label', '堆场五阶段三维示意模型');

  root.innerHTML = `
    <header class="topbar">
      <div class="title-block">
        <div class="eyebrow">PHOSPHOGYPSUM ECOLOGICAL RESTORATION</div>
        <h1>磷石膏堆场生态修复三维可视化平台</h1>
      </div>
      <nav class="site-switch" aria-label="场地切换">
        ${renderSiteButtons(state.currentSite)}
      </nav>
    </header>

    <aside class="panel basics-panel">
      <div class="panel-heading"><span>01</span><h2>场地基础信息</h2></div>
      <h3>${site.name}</h3>
      ${renderBasics(site)}
      <div class="data-source">数据来源：${site.basics.source}</div>
    </aside>

    <section class="scene-panel">
      <div class="scene-host"></div>
      <div class="stage-caption">
        <span>当前阶段</span>
        <h2>${stageLabels[state.currentStage]}</h2>
        <p>${stage.description}</p>
      </div>
      <div class="model-note">示意模型，非真实地形复原</div>
      <div class="control-note">拖动旋转 · 滚轮缩放</div>
    </section>

    <aside class="panel data-panel">
      <div class="panel-heading"><span>02</span><h2>当前阶段数据</h2></div>
      ${renderMeasurements(stage, state)}
    </aside>

    <nav class="stage-nav" aria-label="修复阶段">
      ${renderStageButtons(state.currentStage)}
    </nav>
  `;

  root.querySelector('.scene-host').append(canvas);
}

export function bindDashboardEvents(root, handlers) {
  root.onclick = (event) => {
    const site = event.target.closest('[data-site]');
    const stage = event.target.closest('[data-stage]');
    const group = event.target.closest('[data-group]');
    const sample = event.target.closest('[data-sample]');

    if (site) handlers.onSite(site.dataset.site);
    if (stage) handlers.onStage(stage.dataset.stage);
    if (group) handlers.onGroup(Number(group.dataset.group));
    if (sample) handlers.onSample(Number(sample.dataset.sample));
  };
}
