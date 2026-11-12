export default [
  { match: /^https:\/\/example\.test\/ping$/, file: 'ping.json' },
  { match: /probe-ok\.example\//, file: 'probe/ok.json' },
  { match: /probe-403\.example\//, file: 'probe/ok.json', status: 403 },
  { match: /probe-html\.example\//, file: 'probe/captcha.html', headers: { 'content-type': 'text/html' } },
];
