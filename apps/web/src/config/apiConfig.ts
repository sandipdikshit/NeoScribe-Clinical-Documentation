const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
const API_VERSION = process.env.NEXT_PUBLIC_API_VERSION;
const AUTH_BASE_URL = process.env.NEXT_PUBLIC_AUTH_BASE_URL;
const AUTH_VERSION = process.env.NEXT_PUBLIC_AUTH_VERSION;

export const API_URL = `${API_BASE_URL}/${API_VERSION}`;
export const AUTH_URL = `${AUTH_BASE_URL}/${AUTH_VERSION}`;

export const AES_SECRET_KEY = process.env.NEXT_PUBLIC_AES_SECRET;

export const ENDPOINTS = {
  ANALYZE_TEXT: '/app/analyze_text',
  MEETINGS: '/meetings',
  USERS: '/users/',
  NOTES: '/notes',
  PROCESS_AUDIO: '/transcribe/upload',
  SECTIONS: '/note/sections',
  PATIENTS: '/patients',
  PROVIDER: '/providers/',
  FEEDBACK: '/feedback',
  TEMPLATES: '/templates',
  TEST: '/test',
  // Add other endpoints here

};  

export default ENDPOINTS;