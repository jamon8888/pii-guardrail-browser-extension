import { mount } from 'svelte';
import '../shared/styles/tokens.css';
import { initI18n } from '../shared/i18n';
import App from './App.svelte';

const target = document.getElementById('app');
if (!target) {
  throw new Error('Options mount target #app not found');
}

void initI18n().then(() => mount(App, { target }));
