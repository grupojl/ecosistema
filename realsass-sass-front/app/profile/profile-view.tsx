'use client';
// realsass-sass-front/app/profile/profile-view.tsx
// Client Component — lógica de perfil extraída de page.tsx.
// ECO-FRONT-03: parte del patrón HydrationBoundary (ADR-009/S4-D).
export { default as ProfileView } from '@/app/profile/page-content';
// Si no existe un page-content.tsx, este archivo actúa como barrel.
// La lógica real de los hooks va aquí o en un componente hijo.
