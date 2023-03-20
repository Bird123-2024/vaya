// provided by the edge runtime:
/* global addEventListener */

function buildUrl(requestDetails) {
  const allProtocols = requestDetails.headers['x-forwarded-proto'];
  const host = requestDetails.headers['x-forwarded-host'];
  const path = requestDetails.url;

  if (!allProtocols) {
    throw new Error('missing header "x-forwarded-proto"');
  }
  if (!host) {
    throw new Error('missing header "x-forwarded-host"');
  }
  if (!path) {
    throw new Error('missing url');
  }

  const proto = allProtocols.split(/\b/).shift(); // handling multi-protocol like https,http://...
  return `${proto}://${host}${path}`;
}

async function respond(
  userEdgeHandler,
  requestDetails,
  event,
  options,
  dependencies
) {
  const { Request, Response } = dependencies;
  const { isMiddleware } = options;

  let body;

  if (requestDetails.method !== 'GET' && requestDetails.method !== 'HEAD') {
    if (requestDetails.body) {
      body = Uint8Array.from(atob(requestDetails.body), c => c.charCodeAt(0));
    }
  }

  const request = new Request(buildUrl(requestDetails), {
    headers: requestDetails.headers,
    method: requestDetails.method,
    body: body,
  });

  event.request = request;

  let response = await userEdgeHandler(event.request, event);

  if (!response) {
    if (isMiddleware) {
      // allow empty responses to pass through
      response = new Response(null, {
        headers: {
          'x-middleware-next': '1',
        },
      });
    } else {
      throw new Error(`Execution did not return a response.`);
    }
  }
  return response;
}

function toResponseError(error, entrypointLabel, Response) {
  // we can't easily show a meaningful stack trace
  // so, stick to just the error message for now
  const msg = error.cause
    ? error.message + ': ' + (error.cause.message || error.cause)
    : error.message;
  const fullMessage = `Edge Function "${entrypointLabel}" failed: ${msg}`;
  return new Response(fullMessage, {
    status: 500,
    headers: {
      'x-vercel-failed': 'edge-wrapper',
    },
  });
}

async function parseRequestEvent(event) {
  const serializedRequest = await event.request.text();
  const requestDetails = JSON.parse(serializedRequest);
  return requestDetails;
}

// This will be invoked by logic using this template
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function registerFetchListener(userEdgeHandler, options, dependencies) {
  addEventListener('fetch', async event => {
    try {
      const requestDetails = await parseRequestEvent(event);
      const response = await respond(
        userEdgeHandler,
        requestDetails,
        event,
        options,
        dependencies
      );
      return event.respondWith(response);
    } catch (error) {
      const { entrypointLabel } = options;
      event.respondWith(
        toResponseError(error, entrypointLabel, dependencies.Response)
      );
    }
  });
}

// for testing:
module.exports = {
  buildUrl,
  respond,
  toResponseError,
  parseRequestEvent,
  registerFetchListener,
};
