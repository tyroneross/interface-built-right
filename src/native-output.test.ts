import { describe, it, expect } from 'vitest';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compactNativeRead, compactNativeScanReport, saveNativeReport } from './native-output.js';
import type { MacOSScanResult } from './native/types.js';

describe('native compact evidence', () => {
  it('keeps every failure and coverage gap while omitting verbose inventories', () => {
    const input = {
      url: 'macos://test', timestamp: '2026-11-03', viewport: { width: 390, height: 844 },
      verdict: 'FAIL', summary: 'Unlabeled control; colors unmeasured',
      elements: { all: Array.from({length:500},()=>({text:'A repeated structural node', path:[0,1,2]})) },
      interactivity: { totalInteractive: 1, detailedResults: Array(500).fill({name:'Repeated'}) },
      issues: [{ severity:'error', description:'No accessible label', element:'button' }],
      console:{errors:['Extraction incomplete'],warnings:[]},
      semantic:{verdict:'FAIL',issues:[{problem:'Error banner'}],state:{errors:{present:true}},pageIntent:{intent:'error'}},
      visualCoverage:{textContrast:'unmeasured',reason:'Native AX has no colors'},
      layoutFill:[{reason:'Large blank region'}], designSystem:{passed:false},
    } as unknown as MacOSScanResult;
    const compact=compactNativeScanReport(input,'/private/full.json');
    for(const key of ['issues','verdict','console','visualCoverage','layoutFill','designSystem','semantic'] as const) expect(compact[key]).toEqual(input[key]);
    expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify(input).length/10);
  });
  it('filters structural elements before limiting and retains unnamed/disabled controls', () => {
    const payload={elements:[...Array(300).fill({role:'AXGroup',actions:['AXScrollToVisible','AXShowMenu']}),
      {role:'AXButton',label:'Save changes',enabled:false,frame:{x:1,y:2,width:44,height:44}},
      {role:'AXLink',label:'obsidian://atlas-area?area=notes'}, {role:'AXButton',label:''}]};
    const compact=compactNativeRead(payload,'/private/full.json',2);
    expect(compact.controls.map(e=>e.name)).toEqual(['Save changes','obsidian://atlas-area?area=notes']);
    expect(compact.controls[0].enabled).toBe(false);
    expect(compact.omittedStructural).toBe(300);expect(compact.controlsAvailable).toBe(3);expect(compact.truncated).toBe(true);
    expect(compactNativeRead(payload,'/private/full.json',10).controls[2].name).toBe('');
  });
  it('writes unique private full evidence without overwriting earlier revisions', async () => {
    const dir=await mkdtemp(join(tmpdir(),'ibr-native-output-'));
    try {
      const a=await saveNativeReport({all:'first'},dir),b=await saveNativeReport({all:'second'},dir);
      expect(a).not.toBe(b);expect(JSON.parse(await readFile(a,'utf8'))).toEqual({all:'first'});
      expect((await stat(a)).mode&0o777).toBe(0o600);
    } finally {await rm(dir,{recursive:true,force:true});}
  });
});

it('retains true/false/unknown state and explicitly marks bounded value previews', () => {
  const compact = compactNativeRead({ elements: [
    { role: 'AXTextField', value: 'x'.repeat(4000), enabled: true, selected: true },
    { role: 'AXButton', enabled: false }, { role: 'AXButton' },
  ] }, '/private/full.json', 3);
  expect(compact.controls[0]).toMatchObject({ enabled: true, selected: true, valueTruncated: true, valueLength: 4000 });
  expect(compact.controls[0].value).toHaveLength(256);
  expect(compact.controls[1].enabled).toBe(false);
  expect(compact.controls[2].enabled).toBeUndefined();
});

it('retains selection-bearing rows without AX actions', () => {
  expect(compactNativeRead({ elements: [{ role: 'AXRow', label: 'Chosen task', selected: true, actions: [] }] }, '/private/full.json', 10).controls)
    .toEqual([expect.objectContaining({ role: 'AXRow', name: 'Chosen task', selected: true })]);
});
