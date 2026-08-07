-- Migration 0006 : ajout logo_url aux follows

ALTER TABLE follows ADD COLUMN logo_url TEXT NOT NULL DEFAULT '';
