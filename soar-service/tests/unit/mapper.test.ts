import { loadPlaybook, PlaybookValidationError } from '../../src/playbook/mapper';
import logger from '../../src/logger';

const sampleYaml = `---
version: v1
id: "8d7a3f5c-4c2e-4dee-9434-b36adff5cd4a"
name: "Isolate & Notify"
description: "Blocks network, rotates passwd, pings SecOps."
triggers:
  class: "intrusion"
  severity: [ "high" ]
steps:
  - id: "isolate"
    type: isolate_host
    host: "10.8.0.42"
  - id: "rotate"
    type: reset_password
    host: "10.8.0.42"
    user: "ubuntu"
  - id: "notify"
    type: notify
    channel: "slack"
    target: "#secops"
    message: "Host isolated + password rotated"
---`;

describe('loadPlaybook', () => {
  it('parses valid playbook', () => {
    const pb = loadPlaybook(sampleYaml);
    expect(pb.id).toBe('8d7a3f5c-4c2e-4dee-9434-b36adff5cd4a');
    expect(pb.steps).toHaveLength(3);
    expect(pb.createdAt).toBeDefined();
  });

  it('fails on invalid uuid', () => {
    const bad = sampleYaml.replace('8d7a3f5c-4c2e-4dee-9434-b36adff5cd4a', 'not-uuid');
    expect(() => loadPlaybook(bad)).toThrow(PlaybookValidationError);
  });

  it('fails on duplicate step ids', () => {
    const dupe = sampleYaml.replace('rotate"', 'isolate"');
    expect(() => loadPlaybook(dupe)).toThrow(PlaybookValidationError);
  });

  it('fails on unknown step type', () => {
    const unknown = sampleYaml.replace('type: notify', 'type: bogus');
    expect(() => loadPlaybook(unknown)).toThrow(PlaybookValidationError);
  });

  it('logs warning for unknown field', () => {
    const warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => logger as any);
    const withExtra = sampleYaml.replace('steps:', 'foo: bar\nsteps:');
    loadPlaybook(withExtra);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
