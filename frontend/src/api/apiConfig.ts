const configuredApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();

export const API_BASE_URL = (
  configuredApiBaseUrl
  || (import.meta.env.PROD ? 'https://ontop-be.bata.eu/api' : '/api')
).replace(/\/+$/, '');
