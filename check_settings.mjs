import { getAppSettings } from './server/settings.ts';

const settings = getAppSettings();
console.log('Settings:');
console.log('NVIDIA enabled:', settings.nvidia_enabled);
console.log('NVIDIA API key present:', !!settings.nvidia_api_key?.trim());
console.log('NVIDIA API key length:', settings.nvidia_api_key?.trim().length || 0);
console.log('NVIDIA model:', settings.nvidia_model);
console.log('Groq enabled:', settings.groq_enabled);
console.log('Groq API key present:', !!settings.groq_api_key?.trim());
console.log('Groq API key length:', settings.groq_api_key?.trim().length || 0);
console.log('Groq model:', settings.groq_model);
console.log('Gemini enabled:', settings.gemini_enabled);
console.log('Gemini API key present:', !!process.env.GEMINI_API_KEY?.trim());