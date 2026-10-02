import { beforeEach, describe, expect, it } from 'vitest';
import { captureCvPreset, clearCvTabPreset, parseCvPreset, readCvPreset } from '../cvPreset';

describe('parseCvPreset', () => {
  it('ignores URLs without the cv tab', () => {
    expect(parseCvPreset('')).toBeNull();
    expect(parseCvPreset('?format=nwo')).toBeNull();
    expect(parseCvPreset('?tab=metrics&format=nwo')).toBeNull();
  });

  it('opens the tab and keeps a supported format', () => {
    expect(parseCvPreset('?tab=cv&format=nwo')).toEqual({ openTab: true, format: 'nwo' });
    expect(parseCvPreset('?tab=CV&format=ERC')).toEqual({ openTab: true, format: 'erc' });
    expect(parseCvPreset('?tab=narrativecv&format=msca')).toEqual({ openTab: true, format: 'msca' });
  });

  it('drops unknown formats but still opens the tab', () => {
    expect(parseCvPreset('?tab=cv&format=r4ri')).toEqual({ openTab: true, format: null });
    expect(parseCvPreset('?tab=cv')).toEqual({ openTab: true, format: null });
  });
});

describe('preset storage', () => {
  beforeEach(() => sessionStorage.clear());

  it('round-trips through sessionStorage and clears only the tab flag', () => {
    captureCvPreset('?tab=cv&format=erc&utm_source=guide');
    expect(readCvPreset()).toEqual({ openTab: true, format: 'erc' });
    clearCvTabPreset();
    clearCvTabPreset();
    expect(readCvPreset()).toEqual({ openTab: false, format: 'erc' });
  });

  it('does not overwrite a stored preset when the URL has none', () => {
    captureCvPreset('?tab=cv&format=nwo');
    captureCvPreset('');
    expect(readCvPreset()?.format).toBe('nwo');
  });

  it('rejects tampered storage values', () => {
    sessionStorage.setItem('sf_cv_preset', JSON.stringify({ openTab: 'yes', format: 'evil' }));
    expect(readCvPreset()).toEqual({ openTab: false, format: null });
    sessionStorage.setItem('sf_cv_preset', '{not json');
    expect(readCvPreset()).toBeNull();
  });
});
