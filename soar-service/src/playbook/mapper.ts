import fs from 'fs';
import path from 'path';
import Ajv from 'ajv/dist/2019';
import type { ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { parseAllDocuments, LineCounter, Document, YAMLError, Node } from 'yaml';
import logger from '../logger';
import { PlaybookSchema, Playbook } from './types';

export class PlaybookValidationError extends Error {
  constructor(message: string, public pos?: { line: number; col: number }) {
    super(message);
    this.name = 'PlaybookValidationError';
  }
}

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const validators: Record<string, ValidateFunction> = {};

function getValidator(version: string) {
  if (!validators[version]) {
    const schemaPath = path.join(__dirname, `../../schema/playbook.${version}.json`);
    const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
    validators[version] = ajv.compile(schema);
  }
  return validators[version];
}

function findUnknown(obj: Record<string, unknown>): string[] {
  const unknown: string[] = [];
  const rootKeys = new Set(['version', 'id', 'name', 'description', 'triggers', 'steps', 'createdAt']);
  for (const k of Object.keys(obj)) {
    if (!rootKeys.has(k)) unknown.push(k);
  }
  if (obj.triggers) {
    const trigKeys = new Set(['class', 'severity']);
    for (const k of Object.keys(obj.triggers)) {
      if (!trigKeys.has(k)) unknown.push(`triggers.${k}`);
    }
  }
  if (Array.isArray(obj.steps)) {
    obj.steps.forEach((s: Record<string, unknown>, i: number) => {
      const base = [`steps`, String(i)];
      const allowedBase = new Set(['id', 'type']);
      let allowed = new Set<string>();
      switch (s.type) {
        case 'isolate_host':
          allowed = new Set(['id', 'type', 'host']);
          break;
        case 'reset_password':
          allowed = new Set(['id', 'type', 'host', 'user']);
          break;
        case 'notify':
          allowed = new Set(['id', 'type', 'channel', 'target', 'message']);
          break;
        default:
          allowed = allowedBase;
      }
      for (const k of Object.keys(s)) {
        if (!allowed.has(k)) unknown.push(`${base.join('.')}.${k}`);
      }
    });
  }
  return unknown;
}

function getPos(doc: Document.Parsed, lineCounter: LineCounter, instancePath: string) {
  const parts = instancePath.split('/').slice(1).map(p => p.replace(/~1/g, '/').replace(/~0/g, '~'));
  const node = doc.getIn(parts, true) as Node | null;
  if (node && node.range) {
    return lineCounter.linePos(node.range[0]);
  }
  return undefined;
}

export function loadPlaybook(source: string | Buffer, opts?: { isPath?: boolean; version?: string }): Playbook {
  const yamlText = opts?.isPath ? fs.readFileSync(source.toString(), 'utf8') : source.toString();
  const lineCounter = new LineCounter();
  const docs = parseAllDocuments(yamlText, { lineCounter });
  const doc = docs[0];
  if (!doc) {
    throw new PlaybookValidationError('No document found');
  }
  if (doc.errors.length) {
    const err = doc.errors[0] as YAMLError;
    const pos = lineCounter.linePos(err.pos[0]);
    throw new PlaybookValidationError(err.message, pos);
  }
  const obj = doc.toJS() as Record<string, unknown>;

  const version = opts?.version ?? 'v1';
  const validate = getValidator(version);
  const valid = validate(obj);
  if (!valid) {
    const firstErr = validate.errors?.[0];
    const pos = firstErr ? getPos(doc, lineCounter, firstErr.instancePath) : undefined;
    const message = ajv.errorsText(validate.errors || []);
    throw new PlaybookValidationError(message, pos);
  }

  const unknown = findUnknown(obj);
  for (const p of unknown) logger.warn(`Unknown field ignored: ${p}`);

  const parsed = PlaybookSchema.parse(obj);
  const ids = new Set<string>();
  for (const step of parsed.steps) {
    if (ids.has(step.id)) {
      throw new PlaybookValidationError(`duplicate step id '${step.id}'`);
    }
    ids.add(step.id);
  }
  const result: Playbook = { ...parsed, createdAt: parsed.createdAt ?? new Date().toISOString() };
  return result;
}

export type { Playbook, Step } from './types';
