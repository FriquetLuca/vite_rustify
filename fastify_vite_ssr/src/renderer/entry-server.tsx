import React, { Suspense } from 'react';
import App from '../App.js';
import { I18nextProvider } from 'react-i18next';
import Loading from '../components/Loading.js';
import { StaticRouter } from 'react-router';
import type { IncomingMessage } from 'http';
import type { RouteData } from '../types';
import type { i18n } from 'i18next';

export async function render({
  req,
  i18n,
  props,
}: {
  req: IncomingMessage;
  i18n: i18n;
  props: RouteData;
}) {
  return (
    <React.StrictMode>
      <StaticRouter location={req.url || '/'}>
        <I18nextProvider i18n={i18n}>
          <Suspense fallback={<Loading />}>
            <App props={props} />
          </Suspense>
        </I18nextProvider>
      </StaticRouter>
    </React.StrictMode>
  );
}
