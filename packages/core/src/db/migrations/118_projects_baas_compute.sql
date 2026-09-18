-- Phase 3 BaaS: per-project compute size for the backend containers (gateway + services + rest).
-- Reuses the platform's compute sizes (nano/micro/small). Applied to every backend container at
-- deploy; a Pro user can bump it as their Auth/Functions traffic grows.

ALTER TABLE projects ADD COLUMN IF NOT EXISTS baas_compute_size TEXT NOT NULL DEFAULT 'nano';
