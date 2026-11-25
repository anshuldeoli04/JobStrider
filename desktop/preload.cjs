const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('__JOBSTRIDER_DESKTOP__', {
  isDesktop: true,
  platform: process.platform,
  version: '4.0.0',
});
