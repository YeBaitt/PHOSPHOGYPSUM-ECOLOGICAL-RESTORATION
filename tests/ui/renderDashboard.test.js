import { describe, expect, it, vi } from 'vitest';
import {
  bindDashboardEvents,
  formatValue,
  renderDashboard,
} from '../../src/ui/renderDashboard.js';

const initialState = {
  currentSite: 'sanbanhu',
  currentStage: 'pit',
  activeGroup: 0,
  activeSample: 0,
};

function makeRoot() {
  document.body.innerHTML = '<main id="app"><canvas id="scene-canvas"></canvas></main>';
  return document.querySelector('#app');
}

describe('dashboard rendering', () => {
  it('renders five stages, the selected site, and missing-data copy', () => {
    const root = makeRoot();
    const canvas = root.querySelector('canvas');

    renderDashboard(root, initialState);

    expect(root.querySelectorAll('[data-stage]')).toHaveLength(5);
    expect(root.textContent).toContain('三板湖磷石膏库');
    expect(root.textContent).toContain('暂无数据');
    expect(root.querySelector('canvas')).toBe(canvas);
  });

  it('renders the chosen measured sample and its report source', () => {
    const root = makeRoot();

    renderDashboard(root, {
      currentSite: 'dongxiquan',
      currentStage: 'stack',
      activeGroup: 0,
      activeSample: 0,
    });

    expect(root.textContent).toContain('5.38');
    expect(root.textContent).toContain('1190 mg/kg');
    expect(root.textContent).toContain('磷石膏资源环境数据库最终版0612');
  });

  it('routes site, stage, group, and sample clicks', () => {
    const root = makeRoot();
    renderDashboard(root, {
      ...initialState,
      currentStage: 'stack',
    });
    const handlers = {
      onSite: vi.fn(),
      onStage: vi.fn(),
      onGroup: vi.fn(),
      onSample: vi.fn(),
    };

    bindDashboardEvents(root, handlers);
    root.querySelector('[data-site="dongxiquan"]').click();
    root.querySelector('[data-stage="cover"]').click();
    root.querySelector('[data-group="1"]').click();
    root.querySelector('[data-sample="1"]').click();

    expect(handlers.onSite).toHaveBeenCalledWith('dongxiquan');
    expect(handlers.onStage).toHaveBeenCalledWith('cover');
    expect(handlers.onGroup).toHaveBeenCalledWith(1);
    expect(handlers.onSample).toHaveBeenCalledWith(1);
  });

  it('formats only actual zero as zero and missing values as 暂无数据', () => {
    expect(formatValue(0, 'mg/L')).toBe('0 mg/L');
    expect(formatValue(null, 'mg/L')).toBe('暂无数据');
    expect(formatValue(undefined)).toBe('暂无数据');
  });
});
