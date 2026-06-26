const hopByHopHeaders = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-encoding'
]);

function normalizeBackendApiUrl() {
  const rawUrl = process.env.BACKEND_API_URL || process.env.BACKEND_URL;

  if (!rawUrl) {
    throw new Error('缺少 BACKEND_API_URL 环境变量。');
  }

  const trimmedUrl = rawUrl.replace(/\/+$/, '');
  return trimmedUrl.endsWith('/api') ? trimmedUrl : `${trimmedUrl}/api`;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(chunks.length > 0 ? Buffer.concat(chunks) : undefined));
    req.on('error', reject);
  });
}

function buildTargetUrl(req) {
  const backendApiUrl = normalizeBackendApiUrl();
  const pathValue = req.query.path;
  const queryPath = Array.isArray(pathValue) ? pathValue.join('/') : String(pathValue || '');
  const requestPath = String(req.url || '')
    .split('?')[0]
    .replace(/^\/api\/?/, '');
  const path = queryPath || requestPath;
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(req.query)) {
    if (key === 'path') {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => searchParams.append(key, item));
    } else if (value !== undefined) {
      searchParams.append(key, value);
    }
  }

  const queryString = searchParams.toString();
  return `${backendApiUrl}/${path}${queryString ? `?${queryString}` : ''}`;
}

module.exports = async function handler(req, res) {
  let targetUrl;

  try {
    targetUrl = buildTargetUrl(req);
  } catch (error) {
    return res.status(500).json({
      message: error instanceof Error ? error.message : '后端代理配置错误。'
    });
  }

  const headers = new Headers();

  for (const [key, value] of Object.entries(req.headers)) {
    if (hopByHopHeaders.has(key.toLowerCase()) || value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => headers.append(key, item));
    } else {
      headers.set(key, value);
    }
  }

  const method = req.method || 'GET';
  const body = method === 'GET' || method === 'HEAD' ? undefined : await readRequestBody(req);
  const response = await fetch(targetUrl, {
    method,
    headers,
    body
  });

  response.headers.forEach((value, key) => {
    if (!hopByHopHeaders.has(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  return res.status(response.status).send(buffer);
};
