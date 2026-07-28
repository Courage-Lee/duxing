/**
 * 设置（Settings）数据访问层：以单键值 JSON 持久化全局配置，并合并内置默认值。
 */

import db from './index';
import { Settings } from '../../shared/types';

const DEFAULTS: Settings = {
  baseUrl: 'https://api.deepseek.com/v1',
  model: 'deepseek-chat',
  localOnly: false,
  dailyBriefing: true,
  briefingTime: '09:00',
};

export function loadSettings(): Settings {
  const row = db.prepare('SELECT value FROM settings WHERE key=?').get('settings') as any;
  if (!row) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...JSON.parse(row.value) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Partial<Settings>): Settings {
  const merged = { ...loadSettings(), ...s };
  db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)').run('settings', JSON.stringify(merged));
  return merged;
}
