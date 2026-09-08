export const SITE_IDS = ['sanbanhu', 'dongxiquan'];

export const STAGE_IDS = ['pit', 'liner', 'stack', 'cover', 'restoration'];

const DATABASE_SOURCE = '磷石膏资源环境数据库最终版0612';
const REPORT_SOURCE = '课题结题报告-0614';

const noMeasurements = (description) => ({
  description,
  groups: [],
});

const gypsumLabels = {
  pH: 'pH',
  pb: 'Pb',
  arsenic: 'As',
  totalF: '总氟',
  totalP: '总磷',
};

const gypsumUnits = {
  pH: '',
  pb: 'mg/kg',
  arsenic: 'mg/kg',
  totalF: 'mg/kg',
  totalP: 'mg/kg',
};

const leachateLabels = {
  pH: 'pH',
  cod: 'COD',
  fluoride: '氟化物',
  ammonia: '氨氮',
  totalP: '总磷',
  pb: 'Pb',
  cd: 'Cd',
  tl: 'Tl',
  arsenic: 'As',
};

const leachateUnits = {
  pH: '',
  cod: 'mg/L',
  fluoride: 'mg/L',
  ammonia: 'mg/L',
  totalP: 'mg/L',
  pb: 'μg/L',
  cd: 'μg/L',
  tl: 'μg/L',
  arsenic: 'μg/L',
};

export const sites = {
  sanbanhu: {
    id: 'sanbanhu',
    name: '三板湖磷石膏库',
    basics: {
      location: '湖北省宜都市枝城镇三板湖村',
      capacity: '约1700万 m³',
      sourceType: '混合来源',
      operationStatus: '部分封场、部分运行',
      commissioned: '2003年12月',
      riverDistance: '1.16 km',
      source: DATABASE_SOURCE,
    },
    stages: {
      pit: noMeasurements('展示堆场建设前的原始基坑示意。报告未提供该历史阶段的明确实测数据。'),
      liner: noMeasurements('展示基坑整理及连续防渗层铺设示意。报告未提供该阶段的明确实测数值。'),
      stack: {
        description: '展示磷石膏分层堆填，并提供磷石膏与渗滤液样品数据。',
        groups: [
          {
            id: 'gypsum',
            label: '磷石膏样品',
            source: DATABASE_SOURCE,
            labels: gypsumLabels,
            units: gypsumUnits,
            samples: [
              {
                name: '新鲜磷石膏',
                values: { pH: 2.93, pb: 19.2, arsenic: 1.32, totalF: 4290, totalP: 4430 },
              },
              {
                name: '陈化磷石膏1',
                values: { pH: 4.71, pb: 10.8, arsenic: 1.02, totalF: 4820, totalP: 2090 },
              },
              {
                name: '陈化磷石膏2',
                values: { pH: 2.87, pb: 19.4, arsenic: 1.62, totalF: 5620, totalP: 2531 },
              },
            ],
          },
          {
            id: 'leachate',
            label: '渗滤液样品',
            source: DATABASE_SOURCE,
            labels: leachateLabels,
            units: leachateUnits,
            samples: [
              {
                name: '渗滤液样品1',
                values: {
                  pH: 3.16,
                  cod: 159.5,
                  fluoride: 106.5,
                  ammonia: 178.5,
                  totalP: 1140,
                  pb: 4.45,
                  cd: 7.65,
                  tl: 4.42,
                  arsenic: 165,
                },
              },
              {
                name: '渗滤液样品2',
                values: {
                  pH: 3.09,
                  cod: 185,
                  fluoride: 106,
                  ammonia: 88,
                  totalP: 1220,
                  pb: 2.19,
                  cd: 7.78,
                  tl: 4.69,
                  arsenic: 169,
                },
              },
            ],
          },
        ],
      },
      cover: {
        description: '展示封场整形和覆土，并提供报告中明确标注的覆土样品数据。',
        groups: [
          {
            id: 'cover-soil',
            label: '覆土样品',
            source: DATABASE_SOURCE,
            labels: {
              pH: 'pH',
              totalP: '总磷',
              totalF: '总氟',
              cr: 'Cr',
              ni: 'Ni',
              zn: 'Zn',
              pb: 'Pb',
              cd: 'Cd',
              tl: 'Tl',
              arsenic: 'As',
            },
            units: {
              pH: '',
              totalP: 'mg/kg',
              totalF: 'mg/kg',
              cr: 'mg/kg',
              ni: 'mg/kg',
              zn: 'mg/kg',
              pb: 'mg/kg',
              cd: 'mg/kg',
              tl: 'mg/kg',
              arsenic: 'mg/kg',
            },
            samples: [
              {
                name: '覆土样品1',
                values: {
                  pH: 8.64,
                  totalP: 120,
                  totalF: 676,
                  cr: 75,
                  ni: 25,
                  zn: 65,
                  pb: 30,
                  cd: 0.41,
                  tl: 1.16,
                  arsenic: 23,
                },
              },
              {
                name: '覆土样品2',
                values: {
                  pH: 8.76,
                  totalP: 131,
                  totalF: 692,
                  cr: 76,
                  ni: 24,
                  zn: 61,
                  pb: 29.5,
                  cd: 0.37,
                  tl: 1.13,
                  arsenic: 22.9,
                },
              },
            ],
          },
        ],
      },
      restoration: noMeasurements('报告记录了边坡治理和植被恢复情况，但没有可直接对应到该阶段的场地专属定量监测值。'),
    },
  },
  dongxiquan: {
    id: 'dongxiquan',
    name: '东西泉磷石膏库',
    basics: {
      location: '宜昌市夷陵区鸦鹊岭镇东西泉村',
      capacity: '335万 m³',
      sourceType: '单一来源',
      operationStatus: '采样时未封场',
      commissioned: '一期于2008年投运',
      riverDistance: '17～17.35 km',
      source: DATABASE_SOURCE,
    },
    stages: {
      pit: noMeasurements('展示堆场建设前的原始基坑示意。报告未提供该历史阶段的明确实测数据。'),
      liner: noMeasurements('展示基坑整理及连续防渗层铺设示意。报告未提供该阶段的明确实测数值。'),
      stack: {
        description: '展示磷石膏分层堆填，并提供磷石膏与渗滤液样品数据。',
        groups: [
          {
            id: 'gypsum',
            label: '磷石膏样品',
            source: DATABASE_SOURCE,
            labels: gypsumLabels,
            units: gypsumUnits,
            samples: [
              {
                name: '磷石膏样品1',
                values: { pH: 5.38, pb: 11.2, arsenic: 2.07, totalF: 1190, totalP: 2343 },
              },
              {
                name: '磷石膏样品2',
                values: { pH: 3.67, pb: 11.5, arsenic: 2.49, totalF: 880, totalP: 2351 },
              },
              {
                name: '磷石膏样品3',
                values: { pH: 3.82, pb: 10.2, arsenic: 1.43, totalF: 680, totalP: 2310 },
              },
            ],
          },
          {
            id: 'leachate',
            label: '渗滤液样品',
            source: DATABASE_SOURCE,
            labels: leachateLabels,
            units: leachateUnits,
            samples: [
              {
                name: '渗滤液样品1',
                values: {
                  pH: 3.1,
                  cod: 57,
                  fluoride: 144,
                  ammonia: 82.1,
                  totalP: 758,
                  cd: 10.7,
                  tl: 3.43,
                  arsenic: 271,
                },
              },
              {
                name: '渗滤液样品2',
                values: {
                  pH: 3.05,
                  cod: 75,
                  fluoride: 135,
                  ammonia: 73.4,
                  totalP: 1090,
                  cd: 12.3,
                  tl: 3.54,
                  arsenic: 294,
                },
              },
            ],
          },
        ],
      },
      cover: {
        description: '报告记录东西泉示范区顶部覆土约20 cm。',
        groups: [
          {
            id: 'cover-facts',
            label: '封场覆土信息',
            source: REPORT_SOURCE,
            labels: { coverDepth: '顶部覆土厚度' },
            units: { coverDepth: 'cm' },
            samples: [
              { name: '东西泉示范区', values: { coverDepth: 20 } },
            ],
          },
        ],
      },
      restoration: {
        description: '展示覆土后的植物恢复示意，并提供报告明确记录的示范区信息。',
        groups: [
          {
            id: 'restoration-facts',
            label: '植物修复示范',
            source: REPORT_SOURCE,
            labels: { area: '示范区面积', monitoringInterval: '监测间隔' },
            units: { area: 'm²', monitoringInterval: '月' },
            samples: [
              { name: '东西泉示范区', values: { area: 1000, monitoringInterval: '1～2' } },
            ],
          },
        ],
      },
    },
  },
};

export function getSite(siteId) {
  const site = sites[siteId];
  if (!site) {
    throw new Error(`Unknown site: ${siteId}`);
  }
  return site;
}

export function getStageData(siteId, stageId) {
  const stage = getSite(siteId).stages[stageId];
  if (!stage) {
    throw new Error(`Unknown stage: ${stageId}`);
  }
  return stage;
}
