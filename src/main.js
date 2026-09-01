import './styles.css';
import {
  createDashboardState,
  selectSite,
  selectStage,
} from './state/dashboardState.js';
import {
  bindDashboardEvents,
  renderDashboard,
} from './ui/renderDashboard.js';
import { createScene } from './scene/createScene.js';

const root = document.querySelector('#app');
let state = createDashboardState();
let sceneApi = null;

function update(nextState = state) {
  state = nextState;
  renderDashboard(root, state);
  const canvas = root.querySelector('#scene-canvas');

  try {
    if (!sceneApi) {
      sceneApi = createScene(canvas);
    }
    sceneApi.setStage(state.currentStage);
    sceneApi.resize();
  } catch (error) {
    if (error.message !== 'WEBGL_UNAVAILABLE') throw error;
    root.querySelector('.scene-host').innerHTML = `
      <div class="webgl-error">
        当前浏览器无法显示三维模型，请更新浏览器或启用硬件加速。
      </div>
    `;
  }
}

bindDashboardEvents(root, {
  onSite: (siteId) => update(selectSite(state, siteId)),
  onStage: (stageId) => update(selectStage(state, stageId)),
  onGroup: (activeGroup) => update({ ...state, activeGroup, activeSample: 0 }),
  onSample: (activeSample) => update({ ...state, activeSample }),
});

window.addEventListener('resize', () => sceneApi?.resize());
window.addEventListener('beforeunload', () => sceneApi?.dispose());

update();

