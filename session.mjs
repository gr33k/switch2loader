import { isIP } from 'node:net';

export function ipv4Addresses(interfaces) {
  return [...new Set(Object.entries(interfaces)
    .filter(([name]) => !/^(docker|br-|veth|virbr)/.test(name))
    .flatMap(([, values]) => values)
    .filter(value => value && value.family === 'IPv4' && !value.internal && isIP(value.address) === 4)
    .map(value => value.address))];
}

export function classifyHostLine(line) {
  const stage = /^([1-4])\/4\s/.exec(line);
  const command = /\bV=START\([0-9,]+\)/.exec(line);
  return { stage: stage ? Number(stage[1]) : 0, command: command?.[0] || '', connected: /^Connected\. Checking the application/.test(line), verified: /^FS execution verified\. Original instructions restored and scratch cleaned up\./.test(line) };
}
