import React from 'react';
import { createRoot } from 'react-dom/client';
import { ConfigProvider, App as AntApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Workbench from './Workbench.jsx';
import './style.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#1b6855', colorInfo: '#1b6855', colorText: '#25342f', colorTextSecondary: '#78817c', colorBorder: '#dde3dc', borderRadius: 9, fontSize: 14, controlHeight: 40, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif' }, components: { Button: { primaryShadow: 'none' }, Modal: { borderRadiusLG: 18 }, Tabs: { horizontalItemGutter: 24 } } }}>
      <AntApp><Workbench /></AntApp>
    </ConfigProvider>
  </React.StrictMode>,
);
