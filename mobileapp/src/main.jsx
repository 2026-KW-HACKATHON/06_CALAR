import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useNavigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { App as NativeApp } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Geolocation } from '@capacitor/geolocation';
import App from '../../frontend/src/App';
import '../../frontend/src/styles/variables.css';
import '../../frontend/src/styles/global.css';
import './mobile.css';

if (Capacitor.isNativePlatform()) {
  window.calarMobile = { openPayment: (url) => Browser.open({ url }) };
  // Reuse the existing location hook with native runtime permissions.
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
    getCurrentPosition: (success, failure) => Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 }).then(success).catch(failure),
  } });
}
function NativeNavigation() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handleUrl = async ({ url }) => {
      const target = new URL(url);
      if (target.protocol !== 'calar:' || target.hostname !== 'payment-result') return;
      try { await Browser.close(); } catch { /* Android browser may already be closed. */ }
      navigate(`/customer/payment-result${target.search}`);
    };
    const listener = NativeApp.addListener('appUrlOpen', handleUrl);
    NativeApp.getLaunchUrl().then((result) => { if (result?.url) handleUrl(result); });
    return () => { listener.then((handle) => handle.remove()); };
  }, [navigate]);
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    const listener = NativeApp.addListener('backButton', ({ canGoBack }) => {
      if (['/', '/customer', '/customer/me', '/owner'].includes(pathname) || !canGoBack) NativeApp.minimizeApp();
      else navigate(-1);
    });
    return () => { listener.then((handle) => handle.remove()); };
  }, [navigate, pathname]);
  return <App />;
}
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter><NativeNavigation /></BrowserRouter></React.StrictMode>);
