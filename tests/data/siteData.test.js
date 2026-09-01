import { describe, expect, it } from 'vitest';
import {
  SITE_IDS,
  STAGE_IDS,
  getSite,
  getStageData,
} from '../../src/data/siteData.js';

describe('site data', () => {
  it('contains exactly the two approved sites and five ordered stages', () => {
    expect(SITE_IDS).toEqual(['sanbanhu', 'dongxiquan']);
    expect(STAGE_IDS).toEqual(['pit', 'liner', 'stack', 'cover', 'restoration']);
  });

  it('uses the approved source口径 for site basics', () => {
    expect(getSite('sanbanhu').basics).toMatchObject({
      capacity: '约1700万 m³',
      riverDistance: '1.16 km',
    });
    expect(getSite('dongxiquan').basics).toMatchObject({
      capacity: '335万 m³',
      riverDistance: '17～17.35 km',
    });
  });

  it('preserves original 三板湖 samples instead of calculating averages', () => {
    const gypsum = getStageData('sanbanhu', 'stack').groups[0];
    expect(gypsum.samples).toHaveLength(3);
    expect(gypsum.samples[0].values).toMatchObject({
      pH: 2.93,
      totalF: 4290,
      totalP: 4430,
    });
  });

  it('preserves original 东西泉 leachate values and liquid units', () => {
    const leachate = getStageData('dongxiquan', 'stack').groups[1];
    expect(leachate.units).toMatchObject({ cod: 'mg/L', arsenic: 'μg/L' });
    expect(leachate.samples[1].values).toMatchObject({
      pH: 3.05,
      totalP: 1090,
      arsenic: 294,
    });
  });

  it('represents unavailable measurements as empty groups', () => {
    expect(getStageData('dongxiquan', 'pit').groups).toEqual([]);
    expect(getStageData('sanbanhu', 'restoration').groups).toEqual([]);
  });

  it('rejects unknown identifiers', () => {
    expect(() => getSite('other')).toThrow('Unknown site: other');
    expect(() => getStageData('sanbanhu', 'other')).toThrow('Unknown stage: other');
  });
});
