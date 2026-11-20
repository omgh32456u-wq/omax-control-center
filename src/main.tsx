import React from 'react';
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// Keep the native Android status bar outside the WebView content area.
if (Capacitor.isNativePlatform()) {
  void StatusBar.setOverlaysWebView({ overlay: false });
  void StatusBar.setBackgroundColor({ color: '#0b1220' });
  void StatusBar.setStyle({ style: Style.Light });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
