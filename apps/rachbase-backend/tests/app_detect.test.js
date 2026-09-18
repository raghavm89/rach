'use strict';

/**
 * App-type auto-detection (pure). Runnable-first (Dockerfile FROM a known service), else the
 * detected language's base runtime, else null (BYOI). Tags pinned to majors.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const D = require('../src/services/appDetect');

test('language detection by root manifest → pinned base runtime', () => {
  assert.deepEqual(D.detectFromFiles(['package.json', 'README.md']), { type: 'node', image: 'node:20-alpine', source: 'manifest' });
  assert.equal(D.detectFromFiles(['requirements.txt']).image, 'python:3.12-slim');
  assert.equal(D.detectFromFiles(['pyproject.toml']).type, 'python');
  assert.equal(D.detectFromFiles(['go.mod']).image, 'golang:1.22-alpine');
  assert.equal(D.detectFromFiles(['Gemfile']).image, 'ruby:3.3-slim');
  assert.equal(D.detectFromFiles(['pom.xml']).image, 'eclipse-temurin:21-jre');
  assert.equal(D.detectFromFiles(['composer.json']).image, 'php:8.3-apache');
  assert.equal(D.detectFromFiles(['Cargo.toml']).image, 'rust:1-slim');
});

test('static site → nginx', () => {
  assert.deepEqual(D.detectFromFiles(['index.html', 'style.css']), { type: 'static', image: 'nginx:1.27-alpine', source: 'static' });
});

test('defaultCommandFor suggests a run command per type (fallback is image default → null)', () => {
  assert.equal(D.defaultCommandFor('node'), 'npm start');
  assert.equal(D.defaultCommandFor('python'), 'python app.py');
  assert.equal(D.defaultCommandFor('static'), null);   // static has no run command
  assert.equal(D.defaultCommandFor('unknown'), null);  // unknown → rely on image default
  assert.equal(D.defaultCommandFor(null), null);
});

test('unknown repo → null (BYOI)', () => {
  assert.equal(D.detectFromFiles(['LICENSE', 'notes.txt']), null);
  assert.equal(D.detectFromFiles([]), null);
});

test('Dockerfile FROM a known SERVICE → runnable image (uses their tag if pinned)', () => {
  assert.deepEqual(
    D.detectFromFiles(['Dockerfile'], 'FROM postgres:16\nCOPY init.sql /docker-entrypoint-initdb.d/'),
    { type: 'postgres', image: 'postgres:16', source: 'dockerfile-service' },
  );
  // No tag on FROM → fall back to our pinned service tag.
  assert.equal(D.detectFromFiles(['Dockerfile'], 'FROM redis').image, 'redis:7');
  // Registry-qualified base still resolves by repo name.
  assert.equal(D.detectFromFiles(['Dockerfile'], 'FROM docker.io/library/nginx:1.25').image, 'docker.io/library/nginx:1.25');
});

test('Dockerfile FROM a language base → that language runtime (build path)', () => {
  assert.deepEqual(
    D.detectFromFiles(['Dockerfile', 'package.json'], 'FROM node:20-bookworm\nWORKDIR /app'),
    { type: 'node', image: 'node:20-alpine', source: 'dockerfile-lang' },
  );
  assert.equal(D.detectFromFiles(['Dockerfile'], 'FROM python:3.11').type, 'python');
  assert.equal(D.detectFromFiles(['Dockerfile'], 'FROM eclipse-temurin:21').type, 'java');
});

test('Dockerfile with an unrecognized base → build-from-Dockerfile, no prefill', () => {
  assert.deepEqual(
    D.detectFromFiles(['Dockerfile'], 'FROM my-registry.example.com/base:latest'),
    { type: 'dockerfile', image: null, source: 'dockerfile' },
  );
});

test('Dockerfile takes priority over a language manifest (runnable-first)', () => {
  // repo has package.json AND a Dockerfile FROM postgres → the service wins.
  assert.equal(D.detectFromFiles(['Dockerfile', 'package.json'], 'FROM postgres:16').type, 'postgres');
});

test('runtimeFor maps a detected app type → contract runtime id (§7.1)', () => {
  assert.equal(D.runtimeFor('node'), 'nodejs-22');
  assert.equal(D.runtimeFor('python'), 'python-3.12');
  assert.equal(D.runtimeFor('go'), 'go-1.22');
  assert.equal(D.runtimeFor('static'), 'static');
  assert.equal(D.runtimeFor('postgres'), null); // not a build runtime
  assert.equal(D.runtimeFor(null), null);
});

test('helpers: baseName + dockerfileFrom', () => {
  assert.equal(D.baseName('ghcr.io/acme/redis:7@sha256:abc'), 'redis');
  assert.equal(D.baseName('node:20-alpine'), 'node');
  assert.equal(D.dockerfileFrom('# comment\nFROM --platform=linux/amd64 node:20 AS build'), 'node:20');
  assert.equal(D.dockerfileFrom('ARG X=1\nFROM python:3.12-slim'), 'python:3.12-slim');
  assert.equal(D.dockerfileFrom('no from here'), null);
});
